import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/prompts")({ component: () => <Outlet /> });
