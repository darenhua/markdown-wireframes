import type { ComponentRegistry } from "@json-render/react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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

export const registry: ComponentRegistry = {
  // LAYOUT
  Card: ({ element, children }) => {
    const variant = element.props.variant ?? "default";
    const bg = element.props.bg ?? "default";
    const variantClass = { default: "", outline: "border-2", elevated: "shadow-lg", ghost: "border-none shadow-none bg-transparent" }[variant];
    const bgClass = {
      default: "", muted: "bg-muted",
      pink: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
      purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
      amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      "gradient-warm": "bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 dark:from-pink-950/30 dark:via-rose-950/30 dark:to-orange-950/30",
      "gradient-cool": "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30",
    }[bg];
    return (
      <Card className={cn(variantClass, bgClass)}>
        {(element.props.title || element.props.description) && (
          <CardHeader>
            {element.props.title && <CardTitle>{element.props.title}</CardTitle>}
            {element.props.description && <CardDescription>{element.props.description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>{children}</CardContent>
      </Card>
    );
  },
  Stack: ({ element, children }) => {
    const direction = element.props.direction ?? "vertical";
    const gap = element.props.gap ?? "md";
    const align = element.props.align ?? "stretch";
    const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
    const alignClass = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" }[align];
    return <div className={cn("flex", direction === "horizontal" ? "flex-row" : "flex-col", gapClass, alignClass)}>{children}</div>;
  },
  Grid: ({ element, children }) => {
    const columns = element.props.columns ?? 2;
    const gap = element.props.gap ?? "md";
    const gapClass = { sm: "gap-2", md: "gap-4", lg: "gap-6" }[gap];
    const colClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" }[columns];
    return <div className={cn("grid", colClass, gapClass)}>{children}</div>;
  },
  Box: ({ element, children }) => {
    const bg = element.props.bg ?? "default";
    const padding = element.props.padding ?? "md";
    const rounded = element.props.rounded ?? "md";
    const border = element.props.border ?? false;
    const shadow = element.props.shadow ?? "none";
    const align = element.props.align ?? "left";
    const bgClass = {
      default: "", muted: "bg-muted", primary: "bg-primary text-primary-foreground",
      pink: "bg-pink-100 dark:bg-pink-900/40", purple: "bg-purple-100 dark:bg-purple-900/40",
      amber: "bg-amber-100 dark:bg-amber-900/40", green: "bg-green-100 dark:bg-green-900/40",
      "gradient-warm": "bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 dark:from-pink-900/40 dark:via-rose-900/40 dark:to-orange-900/40",
      "gradient-cool": "bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40",
      "gradient-sunset": "bg-gradient-to-br from-orange-100 via-red-100 to-pink-100 dark:from-orange-900/40 dark:via-red-900/40 dark:to-pink-900/40",
    }[bg];
    const paddingClass = { none: "p-0", sm: "p-2", md: "p-4", lg: "p-6", xl: "p-8" }[padding];
    const roundedClass = { none: "rounded-none", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", full: "rounded-full" }[rounded];
    const shadowClass = { none: "", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg" }[shadow];
    const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[align];
    return <div className={cn(bgClass, paddingClass, roundedClass, shadowClass, alignClass, border && "border")}>{children}</div>;
  },

  // TYPOGRAPHY
  Heading: ({ element }) => {
    const level = element.props.level ?? "2";
    const className = {
      "1": "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
      "2": "scroll-m-20 text-3xl font-semibold tracking-tight",
      "3": "scroll-m-20 text-2xl font-semibold tracking-tight",
      "4": "scroll-m-20 text-xl font-semibold tracking-tight",
    }[level];
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag className={className}>{element.props.text}</Tag>;
  },
  Text: ({ element }) => {
    const variant = element.props.variant ?? "default";
    const size = element.props.size ?? "base";
    const color = element.props.color ?? "default";
    const weight = element.props.weight ?? "normal";
    const align = element.props.align ?? "left";
    const variantClass = { default: "", muted: "text-muted-foreground", error: "text-destructive", success: "text-green-600 dark:text-green-400" }[variant];
    const sizeClass = { sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" }[size];
    const colorClass = {
      default: "text-foreground", primary: "text-primary", pink: "text-pink-600 dark:text-pink-400",
      purple: "text-purple-600 dark:text-purple-400", amber: "text-amber-600 dark:text-amber-400",
      green: "text-green-600 dark:text-green-400",
      gradient: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent",
    }[color];
    const weightClass = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" }[weight];
    const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[align];
    return <p className={cn("leading-7", sizeClass, variant !== "default" ? variantClass : colorClass, weightClass, alignClass)}>{element.props.text}</p>;
  },
  Label: ({ element }) => <Label htmlFor={element.props.htmlFor ?? undefined}>{element.props.text}</Label>,

  // DATA DISPLAY
  Icon: ({ element }) => {
    const name = element.props.name;
    const size = element.props.size ?? "md";
    const color = element.props.color ?? "default";
    const iconMap = {
      heart: Heart, "heart-filled": Heart, star: Star, "star-filled": Star, sparkles: Sparkles,
      gift: Gift, party: PartyPopper, cake: Cake, trophy: Trophy, rocket: Rocket,
      check: Check, "check-circle": CheckCircle, x: X, "arrow-right": ArrowRight, "arrow-left": ArrowLeft,
      plus: Plus, minus: Minus, info: Info, warning: AlertTriangle, zap: Zap,
      sun: Sun, moon: Moon, cloud: Cloud, smile: Smile, "thumbs-up": ThumbsUp,
    };
    const sizeClass = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8", xl: "h-12 w-12", "2xl": "h-16 w-16" }[size];
    const colorClass = {
      default: "text-foreground", muted: "text-muted-foreground", primary: "text-primary",
      pink: "text-pink-500", red: "text-red-500", purple: "text-purple-500", amber: "text-amber-500", green: "text-green-500",
    }[color];
    const IconComponent = iconMap[name as keyof typeof iconMap];
    if (!IconComponent) return null;
    const isFilled = name === "heart-filled" || name === "star-filled" ? "fill-current" : "";
    return <IconComponent className={cn(sizeClass, colorClass, isFilled)} />;
  },
  Metric: ({ element }) => {
    const trend = element.props.trend;
    const trendColor = { up: "text-green-600 dark:text-green-400", down: "text-destructive", neutral: "text-muted-foreground" }[trend ?? "neutral"];
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{element.props.label}</p>
        <p className="text-2xl font-bold">{element.props.value}</p>
        {element.props.change && <p className={cn("text-xs font-medium", trendColor)}>{trend === "up" && "↑ "}{trend === "down" && "↓ "}{element.props.change}</p>}
      </div>
    );
  },
  Badge: ({ element }) => <Badge variant={element.props.variant ?? "default"}>{element.props.text}</Badge>,
  Avatar: ({ element }) => (
    <Avatar>
      {element.props.src && <AvatarImage src={element.props.src} alt={element.props.alt ?? ""} />}
      <AvatarFallback>{element.props.fallback}</AvatarFallback>
    </Avatar>
  ),
  List: ({ element }) => {
    const ordered = element.props.ordered ?? false;
    const Tag = ordered ? "ol" : "ul";
    return <Tag className={cn("my-6 ml-6 [&>li]:mt-2", ordered ? "list-decimal" : "list-disc")}>{element.props.items.map((item: string, index: number) => <li key={index}>{item}</li>)}</Tag>;
  },

  // INTERACTIVE
  Button: ({ element }) => {
    const btn = <Button variant={element.props.variant ?? "default"} size={element.props.size ?? "default"}>{element.props.label}</Button>;
    // If linkTo is provided, wrap in a Link
    if (element.props.linkTo) {
      return <Link to={element.props.linkTo} className="no-underline">{btn}</Link>;
    }
    return btn;
  },
  LinkButton: ({ element, children }) => (
    <Link to={element.props.to ?? "/"} className="no-underline">
      <Button variant={element.props.variant ?? "default"} size={element.props.size ?? "default"}>
        {element.props.label ?? children}
      </Button>
    </Link>
  ),
  Input: ({ element }) => (
    <div className="grid w-full gap-1.5">
      {element.props.label && <Label>{element.props.label}</Label>}
      <Input type={element.props.type ?? "text"} placeholder={element.props.placeholder ?? ""} />
    </div>
  ),
  Textarea: ({ element }) => (
    <div className="grid w-full gap-1.5">
      {element.props.label && <Label>{element.props.label}</Label>}
      <Textarea placeholder={element.props.placeholder ?? ""} rows={element.props.rows ?? 4} />
    </div>
  ),
  Checkbox: ({ element }) => (
    <div className="flex items-center space-x-2">
      <Checkbox id={`checkbox-${element.key}`} defaultChecked={element.props.checked ?? false} />
      <Label htmlFor={`checkbox-${element.key}`}>{element.props.label}</Label>
    </div>
  ),

  // TABS
  Tabs: ({ element, children }) => <Tabs defaultValue={element.props.defaultValue}>{children}</Tabs>,
  TabsList: ({ children }) => <TabsList>{children}</TabsList>,
  TabsTrigger: ({ element }) => <TabsTrigger value={element.props.value}>{element.props.label}</TabsTrigger>,
  TabsContent: ({ element, children }) => <TabsContent value={element.props.value}>{children}</TabsContent>,

  // FEEDBACK
  Alert: ({ element }) => (
    <Alert variant={element.props.variant ?? "default"}>
      <AlertCircle className="h-4 w-4" />
      {element.props.title && <AlertTitle>{element.props.title}</AlertTitle>}
      <AlertDescription>{element.props.message}</AlertDescription>
    </Alert>
  ),

  // UTILITY
  Divider: () => <Separator orientation="horizontal" />,
  Separator: ({ element }) => <Separator orientation={element.props.orientation ?? "horizontal"} />,
  Empty: ({ element }) => {
    const iconType = element.props.icon ?? "inbox";
    const IconComponent = { inbox: Inbox, search: Search, file: FileText, user: User }[iconType];
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-muted p-3"><IconComponent className="h-6 w-6 text-muted-foreground" /></div>
        <p className="text-sm text-muted-foreground">{element.props.message ?? "No content"}</p>
      </div>
    );
  },
};
