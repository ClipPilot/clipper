"use client";

import React from "react";
import { Listbox, ListboxItem, ListboxSection, type Selection } from "@heroui/react";
import { Icon } from "@iconify/react";

export type SidebarItem = {
  key: string;
  title: string;
  icon?: string;
  href?: string;
};

export type SidebarProps = {
  items: SidebarItem[];
  defaultSelectedKey: string;
  onSelect?: (key: string) => void;
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ items, defaultSelectedKey, onSelect }, ref) => {
    const [selected, setSelected] = React.useState<React.Key>(defaultSelectedKey);

    return (
      <Listbox
        ref={ref}
        aria-label="Navigation"
        selectedKeys={[selected] as unknown as Selection}
        selectionMode="single"
        variant="flat"
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          setSelected(key as React.Key);
          onSelect?.(key as string);
        }}
        classNames={{
          list: "gap-1",
        }}
      >
        {items.map((item) => (
          <ListboxItem
            key={item.key}
            textValue={item.title}
            classNames={{
              base: "px-3 py-2.5 rounded-lg data-[selected=true]:bg-accent-400/10 hover:bg-surface-elevated transition-colors",
              title: "text-sm font-medium text-text-secondary data-[selected=true]:text-accent-400",
            }}
            startContent={
              item.icon && (
                <Icon
                  icon={item.icon}
                  width={20}
                  className="text-text-tertiary data-[selected=true]:text-accent-400"
                />
              )
            }
          >
            {item.title}
          </ListboxItem>
        ))}
      </Listbox>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
