// Stream SQL into Docker instead of mounting host paths (portable across Colima).
const name =
  process.env.MAILER_DB_CONTAINER ?? "supabase_db_networking-mailer-manager";
const files = [...new Bun.Glob("supabase/tests/*.sql").scanSync(".")];
if (!files.length) throw new Error("No database tests found.");
let total = 0;
for (const path of files) {
  const process = Bun.spawn(
    [
      "docker",
      "exec",
      "-i",
      name,
      "psql",
      "-X",
      "-q",
      "-t",
      "-A",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdin: Bun.file(path), stdout: "pipe", stderr: "pipe" },
  );
  const [output, error, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  const assertions = output
    .split("\n")
    .filter((line) => /^(?:not )?ok \d/.test(line));
  total += assertions.length;
  if (
    code !== 0 ||
    !assertions.length ||
    assertions.some((line) => line.startsWith("not ok"))
  ) {
    console.error(output, error);
    throw new Error(`Database tests failed: ${path}`);
  }
  console.log(`${path}: ${assertions.length} assertions passed`);
}
console.log(`${total} database assertions passed.`);
