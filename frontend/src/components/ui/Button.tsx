import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "default";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export default function Button({ variant = "default", block, className = "", ...rest }: Props) {
  const classes = ["btn"];
  if (variant === "primary") classes.push("btn-primary");
  if (variant === "ghost") classes.push("btn-ghost");
  if (variant === "danger") classes.push("btn-danger");
  if (block) classes.push("btn-block");
  return <button className={[...classes, className].join(" ").trim()} {...rest} />;
}
