import { createRPCHandle, procedure, stream } from "svelte-rpc";
import { sequence } from "@sveltejs/kit/hooks";
import { date, object, string, array, set, map, optional } from "valibot";
import { createOpenAI } from "@ai-sdk/openai";
import { PRIVATE_OPEN_API_KEY } from "$env/static/private";
import { z } from "zod";
import { type } from "arktype";
import { streamObject, streamText } from "ai";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const openai = createOpenAI({
  apiKey: PRIVATE_OPEN_API_KEY
});

const router = {
  arktype: procedure()
    .input(
      type({
        test: "string"
      })
    )
    .handle(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: {
          id: "string"
        }
      });

      return { user };
    }),
  objectStreaming: procedure()
    .input(z.string())
    .handle(async ({ input }) => {
      const result = await streamObject({
        model: openai("gpt-4o-mini"),
        mode: "json",
        schema: z.array(
          z.object({
            name: z.string().describe("Name of a fictional person."),
            message: z.string().describe("Message. Do not use emojis or links.")
          })
        ),
        output: "object",
        prompt: `Generate 3 notifications for a messages app, make it funny.`
      });

      return result.partialObjectStream;
    }),
  textStreaming: procedure()
    .input(z.string())
    .handle(async ({ input }) => {
      const result = await streamText({
        model: openai("gpt-4o-mini"),
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: input }
        ]
      });
      //

      return result.textStream;

      // return stream(result.textStream, {
      //   onChunk: ({ chunk, first }) => {
      //     console.log("chunk", chunk);
      //   }
      // });
    }),

  route: procedure().handle(async ({ event }) => {
    event.cookies.set("test", new Date().toISOString(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      domain: "localhost",
      secure: false,
      httpOnly: false
    });
    return { data: true };
  }),
  complex: procedure()
    .input(
      z.object({
        title: z.string(),
        description: z.string(),
        folderId: z.string().optional(),
        tags: z.array(
          z.object({
            id: z.string(),
            label: z.string()
          })
        ),
        type: z.enum(["PDF", "AUDIO", "CHAT"])
      })
    )
    .handle(async ({ input }) => {
      return input;
    }),

  test: {
    partial: procedure()
      .input(
        z.object({
          optional: z.string().optional()
        })
      )
      .handle(async ({ input }) => {
        return input;
      }),
    errorTest: procedure()
      .input(
        z.object({
          optional: z.string().optional()
        })
      )
      .handle(async ({ input, event }) => {
        return input;
      }),
    platform: procedure()
      .input(
        z.object({
          optional: z.string().optional()
        })
      )
      .handle(async ({ input, event }) => {
        console.log(event.platform);
        return input;
      }),
    optional: procedure()
      .input(
        optional(
          object({
            string: string()
          })
        )
      )
      .handle(async ({ input }) => {
        return input;
      }),
    noPayload: procedure().handle(async ({ event }) => {
      return { data: true };
    }),
    test: procedure()
      .input(string())
      .handle(async ({ event }) => {
        event.cookies.set("test-1", "test-1", {
          path: "/"
        });
        event.cookies.set("test-2", "test-2", {
          path: "/"
        });
        return { result: undefined, event: event.locals };
      }),
    object: procedure()
      .input(object({ test: string(), date: date() }))
      .handle(async ({ input }) => {
        return { data: true };
      }),
    mapAndSet: procedure()
      .input(
        object({
          set: set(string()),
          map: map(
            string(),
            object({
              name: string(),
              date: date()
            })
          )
        })
      )
      .handle(async ({ input }) => {
        return { input };
      }),
    array: procedure()
      .input(array(object({ test: string(), date: date() })))
      .handle(async ({ event, input }) => {
        console.log({ input });
        return { data: true, input };
      })
  }
};

export type AppRouter = typeof router;

export const handle = sequence(
  ({ event, resolve }) => {
    // console.log(event.platform);
    return resolve(event);
  },
  createRPCHandle({ router, localsApiKey: "api" })
);
