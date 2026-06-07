import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadUserFile } from "@/lib/social";
import { toast } from "sonner";

export function CreatePost({ eventId, onPosted }: { eventId?: string; onPosted?: () => void }) {
  const { user, profile } = useAuth();
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
        Sign in to share match-day moments with the community.
      </div>
    );
  }

  const onUpload = async (f: File) => {
    setBusy(true);
    try {
      const url = await uploadUserFile(user.id, f, "post");
      setImageUrl(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const submit = async () => {
    if (!body.trim() && !imageUrl) return;
    setBusy(true);
    const { error } = await db.from("posts").insert({
      user_id: user.id,
      body: body.trim() || null,
      image_url: imageUrl,
      event_id: eventId ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    setImageUrl(null);
    onPosted?.();
  };

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <UserAvatar name={profile?.full_name} src={profile?.avatar_url} size={40} />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={eventId ? "Share your matchday moment…" : "SAFC is listening… what’s on your mind?"}
          rows={2}
          className="flex-1 resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>
      {imageUrl && (
        <div className="relative mt-2">
          <img src={imageUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />
          <button
            onClick={() => setImageUrl(null)}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ImagePlus className="h-4 w-4" /> Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <button
          onClick={submit}
          disabled={busy || (!body.trim() && !imageUrl)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post
        </button>
      </div>
    </div>
  );
}
