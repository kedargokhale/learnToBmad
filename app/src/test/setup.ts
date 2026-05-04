import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
	isTauri: vi.fn(() => true),
	invoke: vi.fn(),
}));