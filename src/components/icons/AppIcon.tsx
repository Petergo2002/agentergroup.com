"use client";

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  CirclePlus,
  Cloud,
  Filter,
  Info,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  TriangleAlert,
  Trash2,
  Undo2,
  Redo2,
  Bot,
  X,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  add_circle: CirclePlus,
  archive: Archive,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  auto_stories: BookOpenText,
  chat_bubble: MessageSquareText,
  check: Check,
  close: X,
  cloud: Cloud,
  delete: Trash2,
  delete_forever: Trash2,
  event: CalendarDays,
  filter_list: Filter,
  forum: MessageSquareText,
  info: Info,
  mail: Mail,
  menu: Menu,
  more_horiz: MoreHorizontal,
  redo: Redo2,
  search: Search,
  smart_toy: Bot,
  task_alt: Check,
  undo: Undo2,
  warning: TriangleAlert,
} as const;

export type AppIconName = keyof typeof ICONS;

export function AppIcon({
  name,
  className,
  strokeWidth = 2,
  ...props
}: LucideProps & {
  name: AppIconName;
}) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} {...props} />;
}
