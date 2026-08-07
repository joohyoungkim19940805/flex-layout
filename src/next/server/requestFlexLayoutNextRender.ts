"use server";

import { cookies } from "next/headers";
import type {
	FlexLayoutNextCookieOptions,
	FlexLayoutNextRenderRequest,
	FlexLayoutNextRenderRequestResult,
} from "../types";

function validateCookieName(cookieName: string) {
	if (!/^[A-Za-z0-9._-]{1,128}$/.test(cookieName)) {
		throw new Error("Invalid FlexLayout Next cookie name.");
	}
}

function validateIdentifier(value: string, name: string) {
	if (
		value.length === 0 ||
		value.length > 256 ||
		/[\u0000-\u001F\u007F]/.test(value)
	) {
		throw new Error(`Invalid FlexLayout Next ${name}.`);
	}
}

function validateRequest(request: FlexLayoutNextRenderRequest) {
	validateIdentifier(request.requestId, "request id");
	validateIdentifier(request.screenKey, "screen key");

	if (
		request.url.length === 0 ||
		request.url.length > 2048 ||
		/[\u0000-\u001F\u007F\\]/.test(request.url) ||
		/^[A-Za-z][A-Za-z\d+.-]*:/.test(request.url) ||
		/^\/\//.test(request.url)
	) {
		throw new Error(
			"Server-rendered FlexLayout pages require a local relative URL.",
		);
	}

	try {
		if (
			new URL(request.url, "http://flex-layout.local").origin !==
			"http://flex-layout.local"
		) {
			throw new Error();
		}
	} catch {
		throw new Error(
			"Server-rendered FlexLayout pages require a local relative URL.",
		);
	}
}

export async function requestFlexLayoutNextRender(
	cookieName: string,
	cookieOptions: FlexLayoutNextCookieOptions,
	request: FlexLayoutNextRenderRequest,
): Promise<FlexLayoutNextRenderRequestResult> {
	try {
		validateCookieName(cookieName);
		validateRequest(request);

		const value = encodeURIComponent(JSON.stringify(request));
		if (value.length > 3500) {
			throw new Error("FlexLayout Next render request is too large.");
		}

		(await cookies()).set(cookieName, value, {
			path: cookieOptions.path ?? "/",
			domain: cookieOptions.domain,
			httpOnly: cookieOptions.httpOnly ?? true,
			secure:
				cookieOptions.secure ??
				(globalThis as typeof globalThis & {
					process?: { env?: Record<string, string | undefined> };
				}).process?.env?.NODE_ENV === "production",
			sameSite: cookieOptions.sameSite ?? "lax",
			maxAge: cookieOptions.maxAge ?? 10,
		});

		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			message:
				error instanceof Error
					? error.message
					: "Unable to request FlexLayout server rendering.",
		};
	}
}
