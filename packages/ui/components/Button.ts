import { cn } from "@do-wdr/utils";

export function Button(props: {
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const { children, className, ...rest } = props;
  return { type: "button", className: cn(className), children, ...rest };
}
