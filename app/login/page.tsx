import { Suspense } from "react";
import { AuthClient } from "@/components/auth/AuthClient";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthClient />
    </Suspense>
  );
}
