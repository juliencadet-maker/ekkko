import { EditorPreview } from "./EditorPreview";
import { EditorTimeline } from "./EditorTimeline";
import { EditorProperties, BusinessCardPanel, AudioPanel } from "./EditorProperties";
import { EditorToolbar } from "./EditorToolbar";
import { EditorProvider } from "./EditorContext";

interface VideoEditorProps {
  videoUrl: string;
  onSave: (projectJson: string) => void;
  initialProject?: string;
}

export function VideoEditor({ videoUrl, onSave, initialProject }: VideoEditorProps) {
  return (
    <EditorProvider>
      <VideoEditorInner videoUrl={videoUrl} onSave={onSave} initialProject={initialProject} />
    </EditorProvider>
  );
}

import { useEffect } from "react";
import { useEditor } from "./EditorContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

function VideoEditorInner({ videoUrl, onSave, initialProject }: VideoEditorProps) {
  const { state, dispatch } = useEditor();

  useEffect(() => {
    if (initialProject) {
      try {
        const project = JSON.parse(initialProject);
        dispatch({ type: "LOAD_PROJECT", project: { ...project, videoUrl } });
      } catch {
        dispatch({ type: "SET_VIDEO", url: videoUrl, duration: 0 });
      }
    } else {
      dispatch({ type: "SET_VIDEO", url: videoUrl, duration: 0 });
    }
  }, [videoUrl, initialProject, dispatch]);

  const handleSave = () => {
    const projectJson = JSON.stringify({
      ...state,
      videoUrl: "", // Don't store the video URL in the config
    });
    onSave(projectJson);
    toast.success("Projet sauvegardé");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Toolbar */}
      <EditorToolbar onSave={handleSave} />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Preview */}
        <div className="flex-1 flex items-center justify-center p-4 bg-muted/30">
          <div className="w-full max-w-4xl">
            <EditorPreview />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 border-l bg-card flex flex-col">
          <Tabs defaultValue="properties" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b h-9">
              <TabsTrigger value="properties" className="text-xs flex-1">Propriétés</TabsTrigger>
              <TabsTrigger value="card" className="text-xs flex-1">Carte</TabsTrigger>
              <TabsTrigger value="audio" className="text-xs flex-1">Audio</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1">
              <TabsContent value="properties" className="m-0">
                <EditorProperties />
              </TabsContent>
              <TabsContent value="card" className="m-0">
                <BusinessCardPanel />
              </TabsContent>
              <TabsContent value="audio" className="m-0">
                <AudioPanel />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-52 flex-shrink-0">
        <EditorTimeline />
      </div>
    </div>
  );
}
