import { Workspace } from "@/components/workspace";
export default function Preview() {
  return (
    <Workspace
      authenticated={false}
      preview
      providers={{
        supabase: false,
        akash: true,
        together: true,
        groq: true,
        openrouter: true,
        tavily: true,
        google: true,
        encryption: true,
      }}
    />
  );
}
