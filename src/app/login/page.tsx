"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Form, { Field, FormFooter } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import Button from "@atlaskit/button/new";
import Heading from "@atlaskit/heading";
import { token } from "@atlaskit/tokens";
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

  async function handleSubmit(values: Values) {
    setError(null);
    const result = await login(values);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") ? next : "/dashboard");
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
        backgroundColor: token("elevation.surface.sunken"),
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: token("elevation.surface"),
          borderRadius: token("radius.medium"),
          boxShadow: token("elevation.shadow.raised"),
          padding: token("space.500"),
        }}
      >
        <div style={{ marginBottom: token("space.300") }}>
          <Heading size="large">Snaptie</Heading>
          <p
            style={{
              color: token("color.text.subtle"),
              margin: `${token("space.100")} 0 0`,
            }}
          >
            Inicie sessão para aceder à plataforma.
          </p>
        </div>

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
                    type="password"
                    autoComplete="current-password"
                    {...fieldProps}
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
    </main>
  );
}
