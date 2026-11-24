"use client";

import { authClient } from "@sb/auth/client";
import { Button } from "@sb/ui";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
