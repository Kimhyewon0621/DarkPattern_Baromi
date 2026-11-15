import { Icon } from "./Icon";

export type TrackerState = "done" | "active" | "pending" | "unchecked" | "stop" | "skip";
const stateText: Record<TrackerState, string> = { done: "완료", active: "진행 중", pending: "대기", unchecked: "미검사", stop: "여기서 멈춤", skip: "선택 경로에 없음" };

export function Tracker({ steps, label = "검사 단계" }: { steps: { name: string; state: TrackerState; note?: string }[]; label?: string }) {
  return (
    <ol className="tracker" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.name}>
          {index < steps.length - 1 ? <span aria-hidden="true" className={step.state === "done" ? "tracker__line tracker__line--done" : "tracker__line"} /> : null}
          <span className={`tracker__dot tracker__dot--${step.state}`}>{step.state === "done" ? <Icon name="check" size={12} color="#fff" /> : null}</span>
          <span className="tracker__name">{step.name}</span>
          <span className="tracker__state">{step.note ?? stateText[step.state]}</span>
        </li>
      ))}
    </ol>
  );
}

export function SegBar({ states, label }: { states: ("done" | "pending" | "unchecked" | "stop")[]; label: string }) {
  return (
    <span className="segbar" role="img" aria-label={label}>
      {states.map((state, index) => <span key={index} className={state === "pending" ? "" : `is-${state}`} />)}
    </span>
  );
}
