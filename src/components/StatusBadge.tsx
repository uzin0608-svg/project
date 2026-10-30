import { STATUS_LABEL, type Status } from "@/lib/types";

const STYLE: Record<Status, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  caution: "border-amber-200 bg-amber-50 text-amber-700",
  inspect: "border-red-200 bg-red-50 text-red-700",
};

const DOT: Record<Status, string> = {
  normal: "bg-emerald-600",
  caution: "bg-amber-600",
  inspect: "bg-red-600",
};

/** 색과 글자를 함께 보여 줍니다(색만으로 구별하지 않음) */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${STYLE[status]}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const STATUS_TEXT_COLOR: Record<Status, string> = {
  normal: "text-emerald-700",
  caution: "text-amber-700",
  inspect: "text-red-700",
};
