package com.baromi.backend.shop;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.transaction.annotation.Transactional;
import com.baromi.backend.scan.ScanRepository;

@RestController
@RequestMapping("/api/v1/shops")
public class ShopController {
    private final ShopRepository shops;
    private final ScanRepository scans;

    public ShopController(ShopRepository shops, ScanRepository scans) { this.shops = shops; this.scans = scans; }

    @PostMapping
    public ResponseEntity<?> create(@RequestHeader("X-Baromi-Owner") String owner,
                                    @RequestBody CreateShopRequest request) {
        if (owner.isBlank() || request == null || request.consent() != Boolean.TRUE || !isPublicHttps(request.url())) {
            return ResponseEntity.badRequest().body(Map.of("error", "공개 HTTPS 쇼핑몰 URL과 검사 동의가 필요합니다."));
        }
        if (request.id() != null) {
            var existing = shops.findByIdAndOwnerHash(request.id(), ownerHashForApi(owner));
            if (existing.isPresent()) return ResponseEntity.ok(Map.of("shopId", existing.get().getId(), "url", existing.get().getUrl(), "mirrored", true));
        }
        var ownerHash = ownerHashForApi(owner);
        if (request.id() == null) {
            var duplicate = shops.findFirstByOwnerHashAndUrl(ownerHash, request.url());
            if (duplicate.isPresent()) return ResponseEntity.ok(Map.of("shopId", duplicate.get().getId(), "url", duplicate.get().getUrl(), "existing", true));
        }
        var entity = shops.save(new ShopEntity(request.id() == null ? UUID.randomUUID().toString() : request.id(), request.url(), ownerHash, Instant.now()));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("shopId", entity.getId(), "url", entity.getUrl()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@RequestHeader("X-Baromi-Owner") String owner, @PathVariable String id) {
        return shops.findByIdAndOwnerHash(id, ownerHashForApi(owner))
            .<ResponseEntity<?>>map(shop -> {
                var body = new java.util.LinkedHashMap<String, Object>();
                body.put("shopId", shop.getId()); body.put("url", shop.getUrl());
                body.put("consentAt", shop.getConsentAt()); body.put("verifiedAt", shop.getVerifiedAt());
                return ResponseEntity.ok(body);
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestHeader("X-Baromi-Owner") String owner,
                                  @RequestParam(defaultValue = "50") int limit) {
        if (owner.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "소유자 인증이 필요합니다."));
        var safeLimit = Math.min(Math.max(limit, 1), 100);
        var items = shops.findByOwnerHashOrderByConsentAtDesc(ownerHashForApi(owner), PageRequest.of(0, safeLimit))
            .stream().map(shop -> {
                var item = new java.util.LinkedHashMap<String, Object>();
                item.put("shopId", shop.getId()); item.put("url", shop.getUrl());
                item.put("consentAt", shop.getConsentAt()); item.put("verifiedAt", shop.getVerifiedAt());
                return item;
            }).toList();
        return ResponseEntity.ok(Map.of("limit", safeLimit, "shops", items));
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@RequestHeader("X-Baromi-Owner") String owner, @PathVariable String id) {
        var shop = shops.findByIdAndOwnerHash(id, ownerHashForApi(owner));
        if (shop.isEmpty()) return ResponseEntity.notFound().build();
        var history = scans.findByShopIdOrderByCreatedAtDesc(id);
        if (history.stream().anyMatch(scan -> "queued".equals(scan.getStatus()) || "running".equals(scan.getStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "진행 중인 진단이 있어 쇼핑몰을 삭제할 수 없습니다."));
        }
        var scanIds = history.stream().map(scan -> scan.getId()).toList();
        scans.deleteByShopId(id);
        shops.delete(shop.get());
        return ResponseEntity.ok(Map.of("deleted", true, "shopId", id, "deletedScanIds", scanIds));
    }

    public record CreateShopRequest(String id, String url, Boolean consent) {}

    public static String ownerHashForApi(String owner) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(owner.getBytes(StandardCharsets.UTF_8));
            var hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format("%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", impossible);
        }
    }

    private static boolean isPublicHttps(String raw) {
        try {
            var uri = URI.create(raw);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getPort() == -1
                && !uri.getHost().equalsIgnoreCase("localhost") && !uri.getHost().startsWith("127.");
        } catch (IllegalArgumentException ignored) { return false; }
    }
}

