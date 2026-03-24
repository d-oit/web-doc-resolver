import { cn } from "@do-wdr/utils";

export function Input(props: {
  className?: string;
  [key: string]: unknown;
}) {
  const { className, ...rest } = props;
  return { type: "input", className: cn(className), ...rest };
}
