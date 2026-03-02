const { execSync } = require("child_process");
const path = require("path");
const cwd = path.join(__dirname, "..");

try {
  execSync("prisma generate", { stdio: "inherit", cwd });
} catch (err) {
  console.warn(
    "prisma generate failed (e.g. file locked on Windows). Continuing with next build using existing client."
  );
}

try {
  execSync("next build", { stdio: "inherit", cwd, maxBuffer: 50 * 1024 * 1024 });
} catch (err) {
  console.error("Build failed. Exit code:", err.status);
  if (err.stderr) process.stderr.write(err.stderr);
  if (err.stdout) process.stdout.write(err.stdout);
  process.exit(err.status ?? 1);
}
