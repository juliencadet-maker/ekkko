import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileVideo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_SIZE_MB = 500;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime"];

interface VideoImportUploadProps {
  onFileSelected: (file: File) => void;
  onClear: () => void;
  selectedFile: File | null;
}

export function VideoImportUpload({ onFileSelected, onClear, selectedFile }: VideoImportUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Format non supporté", description: "Veuillez importer un fichier MP4 ou MOV.", variant: "destructive" });
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: `La taille maximale est de ${MAX_SIZE_MB} MB.`, variant: "destructive" });
      return;
    }

    onFileSelected(file);
  };

  if (selectedFile) {
    const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
    return (
      <div className="space-y-4">
        <video src={previewUrl || undefined} controls className="w-full rounded-lg bg-black aspect-video" />
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{sizeMB} MB</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/50 hover:bg-muted/30 transition-colors"
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium">Cliquez pour importer une vidéo</p>
      <p className="text-xs text-muted-foreground mt-1">MP4 ou MOV • Max {MAX_SIZE_MB} MB</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
