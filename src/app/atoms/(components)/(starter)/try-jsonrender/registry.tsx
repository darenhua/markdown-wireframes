import type { ComponentRegistry } from "@json-render/react";
import { cn } from "@/lib/utils";

// shadcn/ui components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  FileText,
  Inbox,
  Search,
  User,
  Heart,
  Star,
  Sparkles,
  Gift,
  PartyPopper,
  Cake,
  Trophy,
  Rocket,
  Check,
  CheckCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Info,
  AlertTriangle,
  Zap,
  Smile,
  ThumbsUp,
} from "lucide-react";

/**
 * Registry maps catalog component names to actual React render functions.
 * Uses shadcn/ui components for polished, consistent styling.
 */
export const registry: ComponentRegistry = {
  // ─────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────
  Card: ({ element, children }) => (
    <Card data-element-key={element.key}>
      {(element.props.title || element.props.description) && (
        <CardHeader>
          {element.props.title && <CardTitle>{element.props.title}</CardTitle>}
          {element.props.description && (
            <CardDescription>{element.props.description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  ),

  Stack: ({ element, children }) => {
    const direction = element.props.direction ?? "vertical";
    const gap = element.props.gap ?? "md";
    const align = element.props.align ?? "stretch";

    const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
    const alignClass = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    }[align];

    return (
      <div
        data-element-key={element.key}
        className={cn(
          "flex",
          direction === "horizontal" ? "flex-row" : "flex-col",
          gapClass,
          alignClass
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
      5: "grid-cols-5",
      6: "grid-cols-6",
    }[columns];

    return <div data-element-key={element.key} className={cn("grid", colClass, gapClass)}>{children}</div>;
  },

  Box: ({ element, children }) => {
    const padding = element.props.padding ?? "md";
    const rounded = element.props.rounded ?? "md";
    const border = element.props.border ?? false;
    const shadow = element.props.shadow ?? "none";
    const align = element.props.align ?? "left";

    const paddingClass = {
      none: "p-0",
      sm: "p-2",
      md: "p-4",
      lg: "p-6",
      xl: "p-8",
    }[padding];

    const roundedClass = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      full: "rounded-full",
    }[rounded];

    const shadowClass = {
      none: "",
      sm: "shadow-sm",
      md: "shadow-md",
      lg: "shadow-lg",
    }[shadow];

    const alignClass = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    }[align];

    return (
      <div
        data-element-key={element.key}
        className={cn(
          paddingClass,
          roundedClass,
          shadowClass,
          alignClass,
          border && "border"
        )}
      >
        {children}
      </div>
    );
  },

  // ─────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ─────────────────────────────────────────────────────────────
  Heading: ({ element }) => {
    const level = element.props.level ?? "2";
    const className = {
      "1": "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
      "2": "scroll-m-20 text-3xl font-semibold tracking-tight",
      "3": "scroll-m-20 text-2xl font-semibold tracking-tight",
      "4": "scroll-m-20 text-xl font-semibold tracking-tight",
    }[level];

    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag data-element-key={element.key} className={className}>{element.props.text}</Tag>;
  },

  Text: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const size = element.props.size ?? "base";

    const variantClass = {
      default: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-destructive",
      success: "text-green-600 dark:text-green-400",
    }[variant];

    const sizeClass = {
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
    }[size];

    return (
      <p data-element-key={element.key} className={cn("leading-7", sizeClass, variantClass)}>
        {element.props.text}
      </p>
    );
  },

  Label: ({ element }) => (
    <Label data-element-key={element.key} htmlFor={element.props.htmlFor ?? undefined}>
      {element.props.text}
    </Label>
  ),

  // ─────────────────────────────────────────────────────────────
  // DATA DISPLAY
  // ─────────────────────────────────────────────────────────────
  Icon: ({ element }) => {
    const name = element.props.name;
    const size = element.props.size ?? "md";

    const iconMap = {
      heart: Heart,
      star: Star,
      sparkles: Sparkles,
      gift: Gift,
      party: PartyPopper,
      cake: Cake,
      trophy: Trophy,
      rocket: Rocket,
      check: Check,
      "check-circle": CheckCircle,
      x: X,
      "arrow-right": ArrowRight,
      "arrow-left": ArrowLeft,
      plus: Plus,
      minus: Minus,
      info: Info,
      warning: AlertTriangle,
      zap: Zap,
      smile: Smile,
      "thumbs-up": ThumbsUp,
    };

    const sizeClass = {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
      xl: "h-12 w-12",
    }[size];

    const IconComponent = iconMap[name as keyof typeof iconMap];
    if (!IconComponent) return null;

    return <IconComponent data-element-key={element.key} className={cn(sizeClass, "text-foreground")} />;
  },

  Metric: ({ element }) => {
    const trend = element.props.trend;
    const trendColor = {
      up: "text-green-600 dark:text-green-400",
      down: "text-destructive",
      neutral: "text-muted-foreground",
    }[trend ?? "neutral"];

    return (
      <div data-element-key={element.key} className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          {element.props.label}
        </p>
        <p className="text-2xl font-bold">{element.props.value}</p>
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
    return <Badge data-element-key={element.key} variant={variant}>{element.props.text}</Badge>;
  },

  Avatar: ({ element }) => (
    <Avatar data-element-key={element.key}>
      {element.props.src && (
        <AvatarImage src={element.props.src} alt={element.props.alt ?? ""} />
      )}
      <AvatarFallback>{element.props.fallback}</AvatarFallback>
    </Avatar>
  ),

  List: ({ element }) => {
    const ordered = element.props.ordered ?? false;
    const Tag = ordered ? "ol" : "ul";

    return (
      <Tag
        data-element-key={element.key}
        className={cn(
          "my-6 ml-6 [&>li]:mt-2",
          ordered ? "list-decimal" : "list-disc"
        )}
      >
        {element.props.items.map((item: string, index: number) => (
          <li key={index}>{item}</li>
        ))}
      </Tag>
    );
  },

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE / FORM
  // ─────────────────────────────────────────────────────────────
  Button: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const size = element.props.size ?? "default";
    return (
      <Button data-element-key={element.key} variant={variant} size={size}>
        {element.props.label}
      </Button>
    );
  },

  Input: ({ element }) => (
    <div data-element-key={element.key} className="grid w-full gap-1.5">
      {element.props.label && <Label>{element.props.label}</Label>}
      <Input
        type={element.props.type ?? "text"}
        placeholder={element.props.placeholder ?? ""}
      />
    </div>
  ),

  Textarea: ({ element }) => (
    <div data-element-key={element.key} className="grid w-full gap-1.5">
      {element.props.label && <Label>{element.props.label}</Label>}
      <Textarea
        placeholder={element.props.placeholder ?? ""}
        rows={element.props.rows ?? 4}
      />
    </div>
  ),

  Checkbox: ({ element }) => (
    <div data-element-key={element.key} className="flex items-center space-x-2">
      <Checkbox
        id={`checkbox-${element.key}`}
        defaultChecked={element.props.checked ?? false}
      />
      <Label htmlFor={`checkbox-${element.key}`}>{element.props.label}</Label>
    </div>
  ),

  // ─────────────────────────────────────────────────────────────
  // TABS
  // ─────────────────────────────────────────────────────────────
  Tabs: ({ element, children }) => (
    <Tabs data-element-key={element.key} defaultValue={element.props.defaultValue}>{children}</Tabs>
  ),

  TabsList: ({ element, children }) => <TabsList data-element-key={element.key}>{children}</TabsList>,

  TabsTrigger: ({ element }) => (
    <TabsTrigger data-element-key={element.key} value={element.props.value}>{element.props.label}</TabsTrigger>
  ),

  TabsContent: ({ element, children }) => (
    <TabsContent data-element-key={element.key} value={element.props.value}>{children}</TabsContent>
  ),

  // ─────────────────────────────────────────────────────────────
  // FEEDBACK
  // ─────────────────────────────────────────────────────────────
  Alert: ({ element }) => {
    const variant = element.props.variant ?? "default";
    return (
      <Alert data-element-key={element.key} variant={variant}>
        <AlertCircle className="h-4 w-4" />
        {element.props.title && <AlertTitle>{element.props.title}</AlertTitle>}
        <AlertDescription>{element.props.message}</AlertDescription>
      </Alert>
    );
  },

  // ─────────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────────
  Separator: ({ element }) => (
    <Separator data-element-key={element.key} orientation={element.props.orientation ?? "horizontal"} />
  ),

  Empty: ({ element }) => {
    const iconType = element.props.icon ?? "inbox";
    const IconComponent = {
      inbox: Inbox,
      search: Search,
      file: FileText,
      user: User,
    }[iconType];

    return (
      <div data-element-key={element.key} className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-muted p-3">
          <IconComponent className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {element.props.message ?? "No content"}
        </p>
      </div>
    );
  },
};
