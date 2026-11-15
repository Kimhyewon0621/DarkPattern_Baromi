package com.baromi.backend.scan;
import com.baromi.backend.shop.ShopController;
import com.baromi.backend.shop.ShopRepository;
import java.net.URI; import java.time.Instant; import java.util.LinkedHashMap; import java.util.Map; import java.util.UUID;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*; import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
@RestController @RequestMapping("/api/v1/scans")
public class ScanController {
 private static final ObjectMapper JSON = new ObjectMapper();
 private final ScanRepository scans; private final ShopRepository shops;
 private final String workerToken;
 public ScanController(ScanRepository scans,ShopRepository shops,@Value("${baromi.worker-token:}") String workerToken){this.scans=scans;this.shops=shops;this.workerToken=workerToken;}
 @PostMapping public ResponseEntity<?> create(@RequestHeader("X-Baromi-Owner") String owner,@RequestBody CreateScanRequest request){
  if(owner.isBlank()||request==null||request.shopId()==null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","상점을 찾을 수 없습니다."));
  var shop = shops.findByIdAndOwnerHash(request.shopId(),ShopController.ownerHashForApi(owner));
  if(shop.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","상점을 찾을 수 없습니다."));
  if(!sameHttpsOrigin(shop.get().getUrl(), request.targetUrl()) || !isAllowedExecution(request.executionMode())) return ResponseEntity.badRequest().body(Map.of("error","등록된 쇼핑몰의 HTTPS 주소와 허용된 실행 모드가 필요합니다."));
  if (request.id() != null && scans.findById(request.id()).isPresent()) return ResponseEntity.ok(Map.of("scanId", request.id(), "status", "queued", "mirrored", true));
  var scan=scans.save(new ScanEntity(request.id() == null ? UUID.randomUUID().toString() : request.id(),request.shopId(),"queued",Instant.now(),request.targetUrl(),request.executionMode(),request.viewport(),request.purchasePath()));
  return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("scanId",scan.getId(),"status",scan.getStatus()));
 }
 @PatchMapping("/{id}/status") public ResponseEntity<?> updateStatus(@RequestHeader("X-Baromi-Worker") String token,@PathVariable String id,@RequestBody StatusRequest request){
  if(workerToken.isBlank()||!workerToken.equals(token)||request==null||!isAllowed(request.status())) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","워커 인증이 필요합니다."));
  String phaseResultsJson;
  try { phaseResultsJson = encodePhaseResults(request.phaseResults()); }
  catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Map.of("error", invalid.getMessage())); }
  if (request.reportJson() != null && request.reportJson().length() > 4_000_000)
   return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error","보고서 JSON이 허용 크기를 초과했습니다."));
  var existing = scans.findById(id);
  if (existing.isPresent()) {
   var scan = existing.get();
   if (!canTransition(scan.getStatus(), request.status())) return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","허용되지 않는 진단 상태 전이입니다.","status",scan.getStatus()));
   scan.setStatus(request.status()); scan.setCurrentStage(request.stage());
   if (phaseResultsJson != null) scan.setPhaseResultsJson(phaseResultsJson);
   if (request.reportJson() != null) {
    var days = Math.min(Math.max(retentionDays(), 1), 3650);
    scan.setReportJson(request.reportJson(), Instant.now().plusSeconds(days * 86_400L));
    var duration = reportDuration(request.reportJson());
    if (duration != null) scan.setDurationMs(duration);
   }
   scans.save(scan);
   return ResponseEntity.ok(statusBody(scan));
  }
  var imported = scans.save(new ScanEntity(id, null, request.status(), Instant.now())); imported.setCurrentStage(request.stage());
  if (phaseResultsJson != null) imported.setPhaseResultsJson(phaseResultsJson);
  imported = scans.save(imported);
  var body = statusBody(imported); body.put("imported", true);
  return ResponseEntity.status(HttpStatus.ACCEPTED).body(body);
 }
 @Transactional @PostMapping("/claim") public ResponseEntity<?> claim(@RequestHeader("X-Baromi-Worker") String token){
  if(workerToken.isBlank()||!workerToken.equals(token)) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","워커 인증이 필요합니다."));
  var queued = scans.findFirstByStatusOrderByCreatedAtAscIdAsc("queued");
  if(queued.isEmpty()) return ResponseEntity.noContent().build();
  var scan = queued.get(); scan.setStatus("running"); scan.markStarted(); scans.save(scan);
  var body = statusBody(scan); body.put("shopId",scan.getShopId()); body.put("targetUrl",scan.getTargetUrl()); body.put("executionMode",scan.getExecutionMode()); body.put("viewport",scan.getViewport()); body.put("purchasePath",scan.getPurchasePath()); body.put("startedAt",scan.getStartedAt());
  return ResponseEntity.ok(body);
 }
 @Transactional @PostMapping("/recover") public ResponseEntity<?> recover(@RequestHeader("X-Baromi-Worker") String token,@RequestBody RecoverRequest request){
  if(workerToken.isBlank()||!workerToken.equals(token)||request==null||request.staleBefore()==null) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","워커 인증과 staleBefore가 필요합니다."));
  var stale = scans.findByStatusAndStartedAtBefore("running", request.staleBefore());
  stale.forEach(scan -> { scan.setStatus("failed"); scans.save(scan); });
  return ResponseEntity.ok(Map.of("recovered", stale.size(), "staleBefore", request.staleBefore()));
 }
 @GetMapping("/{id}") public ResponseEntity<?> get(@RequestHeader("X-Baromi-Owner") String owner,@PathVariable String id){
  return scans.findById(id).filter(s->s.getShopId()!=null && shops.findByIdAndOwnerHash(s.getShopId(),ShopController.ownerHashForApi(owner)).isPresent()).<ResponseEntity<?>>map(s->{ var body=statusBody(s); body.put("shopId",s.getShopId()); return ResponseEntity.ok(body); }).orElseGet(()->ResponseEntity.notFound().build());
 }
 @GetMapping("/{id}/report") public ResponseEntity<?> report(@RequestHeader("X-Baromi-Owner") String owner,@PathVariable String id){
  return scans.findById(id).filter(s->s.getShopId()!=null && shops.findByIdAndOwnerHash(s.getShopId(),ShopController.ownerHashForApi(owner)).isPresent())
   .map(s -> {
    if (s.getReportJson() == null || (s.getReportExpiresAt() != null && s.getReportExpiresAt().isBefore(Instant.now())))
     return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","진단 보고서가 만료되었거나 아직 저장되지 않았습니다."));
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(s.getReportJson());
   })
   .orElseGet(() -> ResponseEntity.notFound().build());
 }
 @Transactional @DeleteMapping("/{id}") public ResponseEntity<?> delete(@RequestHeader("X-Baromi-Owner") String owner,@PathVariable String id){
  var scan = scans.findById(id).filter(s -> s.getShopId()!=null && shops.findByIdAndOwnerHash(s.getShopId(),ShopController.ownerHashForApi(owner)).isPresent());
  if(scan.isEmpty()) return ResponseEntity.notFound().build();
  if("queued".equals(scan.get().getStatus()) || "running".equals(scan.get().getStatus()))
   return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","진행 중인 진단은 먼저 중단해 주세요."));
  scans.delete(scan.get());
  return ResponseEntity.ok(Map.of("deleted",true,"scanId",id));
 }
 @GetMapping("/shop/{shopId}") public ResponseEntity<?> listForShop(@RequestHeader("X-Baromi-Owner") String owner,@PathVariable String shopId,@RequestParam(defaultValue="50") int limit){
  if(owner.isBlank() || shops.findByIdAndOwnerHash(shopId,ShopController.ownerHashForApi(owner)).isEmpty()) return ResponseEntity.notFound().build();
  var safeLimit = Math.min(Math.max(limit, 1), 100);
  var items = scans.findByShopIdOrderByCreatedAtDesc(shopId, PageRequest.of(0, safeLimit)).stream().map(ScanController::statusBody).toList();
  return ResponseEntity.ok(Map.of("shopId", shopId, "limit", safeLimit, "scans", items));
 }
 public record CreateScanRequest(String id, String shopId, String targetUrl, String executionMode, String viewport, String purchasePath) {}
 public record StatusRequest(String status, String stage, String reportJson, Map<String,Object> phaseResults) {}
 public record RecoverRequest(Instant staleBefore) {}
 private static LinkedHashMap<String,Object> statusBody(ScanEntity scan){ var body=new LinkedHashMap<String,Object>(); body.put("scanId",scan.getId()); body.put("status",scan.getStatus()); body.put("currentStage",scan.getCurrentStage()); body.put("phaseResults",decodePhaseResults(scan.getPhaseResultsJson())); body.put("shopId",scan.getShopId()); body.put("targetUrl",scan.getTargetUrl()); body.put("executionMode",scan.getExecutionMode()); body.put("viewport",scan.getViewport()); body.put("purchasePath",scan.getPurchasePath()); body.put("createdAt",scan.getCreatedAt()); body.put("updatedAt",scan.getUpdatedAt()); body.put("startedAt",scan.getStartedAt()); body.put("durationMs",scan.getDurationMs()); body.put("reportAvailable",scan.getReportJson()!=null && (scan.getReportExpiresAt()==null || scan.getReportExpiresAt().isAfter(Instant.now()))); var summary=summary(scan.getReportJson()); if(summary!=null) body.put("summary",summary); return body; }
 private static Map<String,Object> summary(String reportJson){
  if(reportJson==null || reportJson.isBlank()) return null;
  try {
   var root=JSON.readValue(reportJson,Map.class);
   var result=new LinkedHashMap<String,Object>();
   var findings=root.get("findings") instanceof java.util.List<?> values ? values : java.util.List.of();
   long suspected=findings.stream().filter(item -> item instanceof Map<?,?> map && "SUSPECTED".equals(map.get("status"))).count();
   long review=findings.stream().filter(item -> item instanceof Map<?,?> map && "REVIEW_NEEDED".equals(map.get("status"))).count();
   var coverage=root.get("ruleCoverage") instanceof Map<?,?> value ? value : Map.of();
   long notTested=coverage.values().stream().filter(item -> item instanceof Map<?,?> map && "NOT_TESTED".equals(map.get("status"))).count();
   result.put("suspected",suspected); result.put("reviewNeeded",review); result.put("notTested",notTested);
   return result;
  } catch(JsonProcessingException invalid){ return null; }
 }
 private static Integer reportDuration(String reportJson){
  try {
   var node=JSON.readTree(reportJson).get("durationMs");
   return node!=null && node.canConvertToInt() && node.intValue()>=0 ? node.intValue() : null;
  } catch(JsonProcessingException invalid){ return null; }
 }
 private static String encodePhaseResults(Map<String,Object> phases){
  if(phases==null) return null;
  try { var json=JSON.writeValueAsString(phases); if(json.length()>262_144) throw new IllegalArgumentException("단계별 진단 상태가 허용 크기를 초과했습니다."); return json; }
  catch(JsonProcessingException invalid){ throw new IllegalArgumentException("단계별 진단 상태 JSON이 올바르지 않습니다."); }
 }
 private static Object decodePhaseResults(String json){
  if(json==null || json.isBlank()) return Map.of();
  try { return JSON.readValue(json, Map.class); }
  catch(JsonProcessingException invalid){ return Map.of(); }
 }
 private static boolean isAllowed(String status){return switch(status){case "queued","running","partial","succeeded","failed","cancelled" -> true; default -> false;};}
 private static boolean canTransition(String from,String to){
  if(from.equals(to)) return true;
  return switch(from){
   case "queued" -> to.equals("running") || to.equals("failed") || to.equals("cancelled");
   case "running" -> to.equals("partial") || to.equals("succeeded") || to.equals("failed") || to.equals("cancelled");
   case "partial" -> to.equals("running") || to.equals("succeeded") || to.equals("failed") || to.equals("cancelled");
   case "succeeded","failed","cancelled" -> false;
   default -> false;
  };
 }
 private static boolean isAllowedExecution(String mode){return mode==null || mode.equals("STATIC") || mode.equals("DYNAMIC");}
 private int retentionDays(){
  try { return Integer.parseInt(System.getenv().getOrDefault("BAROMI_REPORT_RETENTION_DAYS", "30")); }
  catch (NumberFormatException ignored) { return 30; }
 }
 private static boolean sameHttpsOrigin(String registered,String target){
  if(target==null || target.isBlank()) return false;
  try { var base=URI.create(registered); var requested=URI.create(target); return "https".equalsIgnoreCase(requested.getScheme()) && requested.getHost()!=null && requested.getPort()==-1 && requested.getHost().equalsIgnoreCase(base.getHost()); }
  catch(IllegalArgumentException ignored){ return false; }
 }
}
