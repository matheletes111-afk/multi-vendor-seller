const { execSync } = require("child_process");

try {
  execSync("prisma generate", { stdio: "inherit", cwd: require("path").join(__dirname, "..") });
} catch (err) {
  console.warn(
    "prisma generate failed (e.g. file locked on Windows). Continuing with next build using existing client."
  );
}

execSync("next build", { stdio: "inherit", cwd: require("path").join(__dirname, "..") });
