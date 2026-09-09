import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

import { DemoRoleButtons } from "../../_components/demo-role-buttons";
import { LoginForm } from "../../_components/login-form";

const isDemoMode =
  process.env.WASTY_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

export default function LoginV2() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[380px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Sign in to Wasty</h1>
          <p className="text-muted-foreground text-sm">
            Accounts are created by a company owner. Use the email you were given.
          </p>
        </div>

        {isDemoMode ? (
          <div className="space-y-4">
            <DemoRoleButtons />
            <LoginForm />
          </div>
        ) : (
          <LoginForm />
        )}
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{APP_CONFIG.copyright}</div>
        <div className="flex items-center gap-1 text-sm">
          <Globe className="size-4 text-muted-foreground" />
          ENG
        </div>
      </div>
    </>
  );
}
