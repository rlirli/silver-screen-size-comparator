import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CustomScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, width: number, height: number) => void;
}

export function CustomScreen({ isOpen, onClose, onAdd }: CustomScreenProps) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [errors, setErrors] = useState<{ name?: string; width?: string; height?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!name.trim()) {
      nextErrors.name = "Screen label is required";
    }

    const wNum = parseFloat(width);
    if (isNaN(wNum) || wNum <= 0) {
      nextErrors.width = "Width must be a positive number";
    } else if (wNum > 150) {
      nextErrors.width = "Width cannot exceed 150 meters";
    }

    const hNum = parseFloat(height);
    if (isNaN(hNum) || hNum <= 0) {
      nextErrors.height = "Height must be a positive number";
    } else if (hNum > 150) {
      nextErrors.height = "Height cannot exceed 150 meters";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Call submit handler
    onAdd(name.trim(), wNum, hNum);

    // Clear and close
    setName("");
    setWidth("");
    setHeight("");
    setErrors({});
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add Custom Screen Dimensions">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Screen Name / Label"
          placeholder="e.g. My Living Room Wall, Local Cineplex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Width (meters)"
            placeholder="e.g. 15.4"
            type="number"
            step="any"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            error={errors.width}
          />
          <Input
            label="Height (meters)"
            placeholder="e.g. 8.2"
            type="number"
            step="any"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            error={errors.height}
          />
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Add Screen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
