"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button, Dialog, IconButton, Switch } from "@/components/ui";

export interface PanelState {
  id: string;
  visible: boolean;
}

export function CustomizeDialog({
  open,
  onClose,
  panels,
  labels,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  panels: PanelState[];
  labels: Record<string, { label: string; description: string }>;
  onChange: (panels: PanelState[]) => void;
  onReset: () => void;
}) {
  const move = (index: number, delta: number) => {
    const next = [...panels];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Customize dashboard"
      description="Choose which panels to show and their order. Saved in this browser."
      footer={
        <>
          <Button variant="ghost" onClick={onReset}>
            Reset to default
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {panels.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 py-2.5">
            <div className="flex-1">
              <Switch
                checked={p.visible}
                onChange={(visible) => onChange(panels.map((x) => (x.id === p.id ? { ...x, visible } : x)))}
                label={labels[p.id]?.label ?? p.id}
                description={labels[p.id]?.description}
              />
            </div>
            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton label="Move down" disabled={i === panels.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="size-4" />
            </IconButton>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
