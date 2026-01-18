"use client";

import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

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
  Sun,
  Moon,
  Cloud,
  Smile,
  ThumbsUp,
} from "lucide-react";

// ============ LAYOUT COMPONENTS ============

interface RenderCardProps {
  title?: string;
  description?: string;
  variant?: "default" | "outline" | "elevated" | "ghost";
  bg?: "default" | "muted" | "pink" | "purple" | "amber" | "gradient-warm" | "gradient-cool";
  children?: ReactNode;
}

export function RenderCard({ title, description, variant = "default", bg = "default", children }: RenderCardProps) {
  const variantClass = {
    default: "",
    outline: "border-2",
    elevated: "shadow-lg",
    ghost: "border-none shadow-none bg-transparent",
  }[variant];

  const bgClass = {
    default: "",
    muted: "bg-muted",
    pink: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
    purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    "gradient-warm": "bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 dark:from-pink-950/30 dark:via-rose-950/30 dark:to-orange-950/30",
    "gradient-cool": "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30",
  }[bg];

  return (
    <Card className={cn(variantClass, bgClass)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface RenderStackProps {
  direction?: "horizontal" | "vertical";
  gap?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "stretch";
  children?: ReactNode;
}

export function RenderStack({ direction = "vertical", gap = "md", align = "stretch", children }: RenderStackProps) {
  const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
  const alignClass = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" }[align];
  return <div className={cn("flex", direction === "horizontal" ? "flex-row" : "flex-col", gapClass, alignClass)}>{children}</div>;
}

interface RenderGridProps {
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: "sm" | "md" | "lg";
  children?: ReactNode;
}

export function RenderGrid({ columns = 2, gap = "md", children }: RenderGridProps) {
  const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
  const colClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" }[columns];
  return <div className={cn("grid", colClass, gapClass)}>{children}</div>;
}

interface RenderBoxProps {
  bg?: "default" | "muted" | "primary" | "pink" | "purple" | "amber" | "green" | "gradient-warm" | "gradient-cool" | "gradient-sunset";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
  border?: boolean;
  shadow?: "none" | "sm" | "md" | "lg";
  align?: "left" | "center" | "right";
  children?: ReactNode;
}

export function RenderBox({ bg = "default", padding = "md", rounded = "md", border = false, shadow = "none", align = "left", children }: RenderBoxProps) {
  const bgClass = {
    default: "",
    muted: "bg-muted",
    primary: "bg-primary text-primary-foreground",
    pink: "bg-pink-100 dark:bg-pink-900/40",
    purple: "bg-purple-100 dark:bg-purple-900/40",
    amber: "bg-amber-100 dark:bg-amber-900/40",
    green: "bg-green-100 dark:bg-green-900/40",
    "gradient-warm": "bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 dark:from-pink-900/40 dark:via-rose-900/40 dark:to-orange-900/40",
    "gradient-cool": "bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40",
    "gradient-sunset": "bg-gradient-to-br from-orange-100 via-red-100 to-pink-100 dark:from-orange-900/40 dark:via-red-900/40 dark:to-pink-900/40",
  }[bg];
  const paddingClass = { none: "p-0", sm: "p-2", md: "p-4", lg: "p-6", xl: "p-8" }[padding];
  const roundedClass = { none: "rounded-none", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", full: "rounded-full" }[rounded];
  const shadowClass = { none: "", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg" }[shadow];
  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[align];
  return <div className={cn(bgClass, paddingClass, roundedClass, shadowClass, alignClass, border && "border")}>{children}</div>;
}

// ============ TYPOGRAPHY COMPONENTS ============

interface RenderHeadingProps {
  text: string;
  level?: "1" | "2" | "3" | "4";
}

export function RenderHeading({ text, level = "2" }: RenderHeadingProps) {
  const className = {
    "1": "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
    "2": "scroll-m-20 text-3xl font-semibold tracking-tight",
    "3": "scroll-m-20 text-2xl font-semibold tracking-tight",
    "4": "scroll-m-20 text-xl font-semibold tracking-tight",
  }[level];
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={className}>{text}</Tag>;
}

interface RenderTextProps {
  text: string;
  variant?: "default" | "muted" | "error" | "success";
  size?: "sm" | "base" | "lg" | "xl" | "2xl";
  color?: "default" | "primary" | "pink" | "purple" | "amber" | "green" | "gradient";
  weight?: "normal" | "medium" | "semibold" | "bold";
  align?: "left" | "center" | "right";
}

export function RenderText({ text, variant = "default", size = "base", color = "default", weight = "normal", align = "left" }: RenderTextProps) {
  const variantClass = { default: "", muted: "text-muted-foreground", error: "text-destructive", success: "text-green-600 dark:text-green-400" }[variant];
  const sizeClass = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" }[size];
  const colorClass = {
    default: "text-foreground",
    primary: "text-primary",
    pink: "text-pink-600 dark:text-pink-400",
    purple: "text-purple-600 dark:text-purple-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-green-600 dark:text-green-400",
    gradient: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent",
  }[color];
  const weightClass = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" }[weight];
  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[align];
  return <p className={cn("leading-7", sizeClass, variant !== "default" ? variantClass : colorClass, weightClass, alignClass)}>{text}</p>;
}

interface RenderLabelProps {
  text: string;
  htmlFor?: string;
}

export function RenderLabel({ text, htmlFor }: RenderLabelProps) {
  return <Label htmlFor={htmlFor}>{text}</Label>;
}

// ============ DATA DISPLAY COMPONENTS ============

const iconMap = {
  heart: Heart,
  "heart-filled": Heart,
  star: Star,
  "star-filled": Star,
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
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  smile: Smile,
  "thumbs-up": ThumbsUp,
};

interface RenderIconProps {
  name: keyof typeof iconMap;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  color?: "default" | "muted" | "primary" | "pink" | "red" | "purple" | "amber" | "green";
}

export function RenderIcon({ name, size = "md", color = "default" }: RenderIconProps) {
  const sizeClass = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8", xl: "h-12 w-12", "2xl": "h-16 w-16" }[size];
  const colorClass = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    primary: "text-primary",
    pink: "text-pink-500",
    red: "text-red-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
    green: "text-green-500",
  }[color];
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;
  const isFilled = name === "heart-filled" || name === "star-filled" ? "fill-current" : "";
  return <IconComponent className={cn(sizeClass, colorClass, isFilled)} />;
}

interface RenderMetricProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export function RenderMetric({ label, value, change, trend }: RenderMetricProps) {
  const trendColor = { up: "text-green-600 dark:text-green-400", down: "text-destructive", neutral: "text-muted-foreground" }[trend ?? "neutral"];
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {change && (
        <p className={cn("text-xs font-medium", trendColor)}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {change}
        </p>
      )}
    </div>
  );
}

interface RenderBadgeProps {
  text: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function RenderBadge({ text, variant = "default" }: RenderBadgeProps) {
  return <Badge variant={variant}>{text}</Badge>;
}

interface RenderAvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
}

export function RenderAvatar({ src, alt, fallback }: RenderAvatarProps) {
  return (
    <Avatar>
      {src && <AvatarImage src={src} alt={alt ?? ""} />}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

interface RenderListProps {
  items: string[];
  ordered?: boolean;
}

export function RenderList({ items, ordered = false }: RenderListProps) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("my-6 ml-6 [&>li]:mt-2", ordered ? "list-decimal" : "list-disc")}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
}

// ============ INTERACTIVE COMPONENTS ============

interface RenderButtonProps {
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  linkTo?: string;
}

export function RenderButton({ label, variant = "default", size = "default", linkTo }: RenderButtonProps) {
  const btn = <Button variant={variant} size={size}>{label}</Button>;
  if (linkTo) {
    return <Link to={linkTo} className="no-underline">{btn}</Link>;
  }
  return btn;
}

interface RenderLinkButtonProps {
  to: string;
  label?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  children?: ReactNode;
}

export function RenderLinkButton({ to, label, variant = "default", size = "default", children }: RenderLinkButtonProps) {
  return (
    <Link to={to} className="no-underline">
      <Button variant={variant} size={size}>
        {label ?? children}
      </Button>
    </Link>
  );
}

interface RenderInputProps {
  label?: string;
  type?: string;
  placeholder?: string;
}

export function RenderInput({ label, type = "text", placeholder = "" }: RenderInputProps) {
  return (
    <div className="grid w-full gap-1.5">
      {label && <Label>{label}</Label>}
      <Input type={type} placeholder={placeholder} />
    </div>
  );
}

interface RenderTextareaProps {
  label?: string;
  placeholder?: string;
  rows?: number;
}

export function RenderTextarea({ label, placeholder = "", rows = 4 }: RenderTextareaProps) {
  return (
    <div className="grid w-full gap-1.5">
      {label && <Label>{label}</Label>}
      <Textarea placeholder={placeholder} rows={rows} />
    </div>
  );
}

interface RenderCheckboxProps {
  label: string;
  checked?: boolean;
  id?: string;
}

export function RenderCheckbox({ label, checked = false, id }: RenderCheckboxProps) {
  const checkboxId = id ?? `checkbox-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={checkboxId} defaultChecked={checked} />
      <Label htmlFor={checkboxId}>{label}</Label>
    </div>
  );
}

// ============ TABS COMPONENTS ============

interface RenderTabsProps {
  defaultValue: string;
  children?: ReactNode;
}

export function RenderTabs({ defaultValue, children }: RenderTabsProps) {
  return <Tabs defaultValue={defaultValue}>{children}</Tabs>;
}

interface RenderTabsListProps {
  children?: ReactNode;
}

export function RenderTabsList({ children }: RenderTabsListProps) {
  return <TabsList>{children}</TabsList>;
}

interface RenderTabsTriggerProps {
  value: string;
  label: string;
}

export function RenderTabsTrigger({ value, label }: RenderTabsTriggerProps) {
  return <TabsTrigger value={value}>{label}</TabsTrigger>;
}

interface RenderTabsContentProps {
  value: string;
  children?: ReactNode;
}

export function RenderTabsContent({ value, children }: RenderTabsContentProps) {
  return <TabsContent value={value}>{children}</TabsContent>;
}

// ============ FEEDBACK COMPONENTS ============

interface RenderAlertProps {
  title?: string;
  message: string;
  variant?: "default" | "destructive";
}

export function RenderAlert({ title, message, variant = "default" }: RenderAlertProps) {
  return (
    <Alert variant={variant}>
      <AlertCircle className="h-4 w-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// ============ UTILITY COMPONENTS ============

interface RenderDividerProps {
  orientation?: "horizontal" | "vertical";
}

export function RenderDivider({ orientation = "horizontal" }: RenderDividerProps) {
  return <Separator orientation={orientation} />;
}

interface RenderSeparatorProps {
  orientation?: "horizontal" | "vertical";
}

export function RenderSeparator({ orientation = "horizontal" }: RenderSeparatorProps) {
  return <Separator orientation={orientation} />;
}

const emptyIconMap = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  user: User,
};

interface RenderEmptyProps {
  message?: string;
  icon?: keyof typeof emptyIconMap;
}

export function RenderEmpty({ message = "No content", icon = "inbox" }: RenderEmptyProps) {
  const IconComponent = emptyIconMap[icon];
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-3">
        <IconComponent className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
