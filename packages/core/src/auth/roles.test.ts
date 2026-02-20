import { describe, expect, it } from "bun:test";
import { hasAnyRole, hasRole, parseCommaSeparatedRoles } from "./roles";

describe("role helpers", () => {
	it("parses comma-separated roles into normalized values", () => {
		expect(parseCommaSeparatedRoles(" Admin, member ,SUPPORT ")).toEqual([
			"admin",
			"member",
			"support",
		]);
	});

	it("returns an empty array for nullish role values", () => {
		expect(parseCommaSeparatedRoles(null)).toEqual([]);
		expect(parseCommaSeparatedRoles(undefined)).toEqual([]);
		expect(parseCommaSeparatedRoles("")).toEqual([]);
	});

	it("checks for a single role match", () => {
		expect(hasRole("admin,support", "admin")).toBe(true);
		expect(hasRole("admin,support", "member")).toBe(false);
	});

	it("checks whether any role matches", () => {
		expect(hasAnyRole("member,admin", ["owner", "admin"])).toBe(true);
		expect(hasAnyRole("member,support", ["owner", "admin"])).toBe(false);
	});
});
