# learnToBmad

Starter repository for learning and experiments.

## Application Setup (Story 1.1)

The desktop app is scaffolded in [app](app) using Tauri v2 + React + TypeScript + Vite.

### Prerequisites (Windows)

1. Node.js 20+
2. pnpm 10+
3. Rust toolchain (rustup, cargo, rustc)
4. Visual Studio 2022 Build Tools with C++ workload (required for `link.exe`)

### Install Dependencies

```powershell
Set-Location .\app
pnpm install
```

### Run Desktop App in Development

```powershell
Set-Location .\app
pnpm tauri dev
```

### Build Windows Artifacts

```powershell
Set-Location .\app
pnpm tauri build
```

## Repository Getting Started

1. Clone the repository.
2. Add your project files.
3. Commit and push your changes.

## Notes

- Keep code and docs organized by feature.
- Update this README as the project evolves.
