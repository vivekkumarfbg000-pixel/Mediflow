import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const cmd = new Deno.Command("git", {
      args: ["checkout", "--", "frontend/src/components/pharmacy/PharmacyDashboard.tsx"],
      cwd: "C:/Users/vivek/OneDrive/Desktop/Mediflow ecosystem"
    });
    const { code, stdout, stderr } = await cmd.output();
    return new Response(JSON.stringify({ 
      success: true, 
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr)
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
})
