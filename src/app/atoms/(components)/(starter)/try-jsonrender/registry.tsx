import type { ComponentRegistry } from "@json-render/react";
import { cn } from "@/lib/utils";

/**
 * Registry maps catalog component names to actual React render functions.
 * Each component receives `element` (with props) and optionally `children`.
 */
export const registry: ComponentRegistry = {
  // Layout
  Card: ({ element, children }) => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {element.props.title && (
        <h3 className="mb-3 text-base font-medium tracking-tight">
          {element.props.title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  ),

  Stack: ({ element, children }) => {
    const direction = element.props.direction ?? "vertical";
    const gap = element.props.gap ?? "md";
    const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];

    return (
      <div
        className={cn(
          "flex",
          direction === "horizontal" ? "flex-row" : "flex-col",
          gapClass
        )}
      >
        {children}
      </div>
    );
  },

  Grid: ({ element, children }) => {
    const columns = element.props.columns ?? 2;
    const gap = element.props.gap ?? "md";
    const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
    const colClass = {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[columns];

    return <div className={cn("grid", colClass, gapClass)}>{children}</div>;
  },

  // Typography
  Heading: ({ element }) => {
    const level = element.props.level ?? "2";
    const className = {
      "1": "text-2xl font-semibold tracking-tight",
      "2": "text-xl font-medium tracking-tight",
      "3": "text-lg font-medium",
    }[level];

    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag className={className}>{element.props.text}</Tag>;
  },

  Text: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const className = {
      default: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-destructive",
      success: "text-green-600 dark:text-green-400",
    }[variant];

    return (
      <p className={cn("text-sm leading-relaxed", className)}>
        {element.props.text}
      </p>
    );
  },

  // Data Display
  Metric: ({ element }) => {
    const trend = element.props.trend;
    const trendColor = {
      up: "text-green-600 dark:text-green-400",
      down: "text-destructive",
      neutral: "text-muted-foreground",
    }[trend ?? "neutral"];

    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {element.props.label}
        </p>
        <p className="text-2xl font-semibold tracking-tight">
          {element.props.value}
        </p>
        {element.props.change && (
          <p className={cn("text-xs font-medium", trendColor)}>
            {trend === "up" && "↑ "}
            {trend === "down" && "↓ "}
            {element.props.change}
          </p>
        )}
      </div>
    );
  },

  Badge: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const className = {
      default: "bg-muted text-muted-foreground",
      success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    }[variant];

    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          className
        )}
      >
        {element.props.text}
      </span>
    );
  },

  List: ({ element }) => {
    const ordered = element.props.ordered ?? false;
    const Tag = ordered ? "ol" : "ul";

    return (
      <Tag className={cn("space-y-1 text-sm", ordered ? "list-decimal" : "list-disc", "ml-4")}>
        {element.props.items.map((item: string, index: number) => (
          <li key={index}>{item}</li>
        ))}
      </Tag>
    );
  },

  // Interactive
  Button: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const className = {
      default: "bg-muted text-foreground hover:bg-muted/80",
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-muted",
    }[variant];

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          className
        )}
      >
        {element.props.label}
      </button>
    );
  },

  Input: ({ element }) => (
    <div className="space-y-1.5">
      {element.props.label && (
        <label className="text-sm font-medium">{element.props.label}</label>
      )}
      <input
        type={element.props.type ?? "text"}
        placeholder={element.props.placeholder ?? ""}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  ),

  // Feedback
  Alert: ({ element }) => {
    const variant = element.props.variant ?? "info";
    const className = {
      info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      success: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400",
      warning: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      error: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
    }[variant];

    return (
      <div className={cn("rounded-lg border p-4 text-sm", className)}>
        {element.props.message}
      </div>
    );
  },

  // Utility
  Divider: () => <hr className="border-border" />,

  Empty: ({ element }) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2 size-10 rounded-full bg-muted flex items-center justify-center">
        <svg
          className="size-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">
        {element.props.message ?? "No content"}
      </p>
    </div>
  ),
};
