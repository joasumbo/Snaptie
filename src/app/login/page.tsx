"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Form, { Field, FormFooter } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import Button, { IconButton } from "@atlaskit/button/new";
import { token } from "@atlaskit/tokens";
import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import EyeHiddenIcon from "@atlaskit/icon/core/eye-open-strikethrough";
import { login } from "./actions";

type Values = { email: string; password: string };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(values: Values) {
    setError(null);
    const result = await login(values);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Only follow `next` into the protected area, never to arbitrary paths.
    const next = searchParams.get("next");
    const destination = next && next.startsWith("/dashboard") ? next : "/dashboard";
    router.replace(destination);
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: token("space.400"),
        background: `linear-gradient(180deg, ${token(
          "elevation.surface.sunken",
        )} 0%, ${token("elevation.surface")} 100%)`,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: token("space.150"),
            justifyContent: "center",
            marginBottom: token("space.300"),
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: token("radius.small"),
              backgroundColor: token("color.background.brand.bold"),
            }}
            aria-hidden
          />
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Snaptie
          </span>
        </div>

        <div
          style={{
            backgroundColor: token("elevation.surface"),
            border: `1px solid ${token("color.border")}`,
            borderRadius: token("radius.large"),
            boxShadow: token("elevation.shadow.overlay"),
            padding: token("space.500"),
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Iniciar sessão</h1>
          <p
            style={{
              color: token("color.text.subtle"),
              margin: `${token("space.100")} 0 ${token("space.300")}`,
            }}
          >
            Aceda à sua conta para gerir a plataforma.
          </p>

          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: token("space.200"),
                padding: token("space.200"),
                borderRadius: token("radius.small"),
                backgroundColor: token("color.background.danger"),
                color: token("color.text.danger"),
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <Form<Values> onSubmit={handleSubmit}>
            {({ formProps, submitting }) => (
              <form {...formProps}>
                <Field name="email" label="Email" isRequired defaultValue="">
                  {({ fieldProps }) => (
                    <Textfield
                      type="email"
                      autoComplete="email"
                      placeholder="nome@empresa.pt"
                      {...fieldProps}
                    />
                  )}
                </Field>
                <Field
                  name="password"
                  label="Palavra-passe"
                  isRequired
                  defaultValue=""
                >
                  {({ fieldProps }) => (
                    <Textfield
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      {...fieldProps}
                      elemAfterInput={
                        <div style={{ paddingRight: 4, display: "flex" }}>
                          <IconButton
                            type="button"
                            appearance="subtle"
                            spacing="compact"
                            icon={showPassword ? EyeHiddenIcon : EyeOpenIcon}
                            label={
                              showPassword
                                ? "Ocultar palavra-passe"
                                : "Mostrar palavra-passe"
                            }
                            onClick={() => setShowPassword((v) => !v)}
                          />
                        </div>
                      }
                    />
                  )}
                </Field>
                <FormFooter align="start">
                  <Button
                    type="submit"
                    appearance="primary"
                    isLoading={submitting}
                    shouldFitContainer
                  >
                    Entrar
                  </Button>
                </FormFooter>
              </form>
            )}
          </Form>
        </div>
      </div>
    </main>
  );
}
