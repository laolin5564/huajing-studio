import { describe, expect, test } from "bun:test";
import { awesomeCaseLibrary, listAwesomeCases } from "@/lib/awesome-case-library";

describe("awesome gpt-image-2 case library", () => {
  test("normalizes the upstream case gallery with remote image URLs", () => {
    expect(awesomeCaseLibrary.cases.length).toBe(awesomeCaseLibrary.totalCases);
    expect(awesomeCaseLibrary.categories.length).toBeGreaterThan(5);
    expect(awesomeCaseLibrary.cases[0].imageUrl.startsWith("https://raw.githubusercontent.com/")).toBe(true);
    expect(awesomeCaseLibrary.cases[0].promptZh.includes("生成一张")).toBe(true);
  });

  test("filters and paginates cases without loading all prompts into the client", () => {
    const firstPage = listAwesomeCases({ category: "Products & E-commerce", pageSize: 6 });
    const secondPage = listAwesomeCases({ category: "Products & E-commerce", page: 2, pageSize: 6 });

    expect(firstPage.cases.length).toBe(6);
    expect(firstPage.filteredCount).toBeGreaterThan(6);
    expect(secondPage.cases[0].id !== firstPage.cases[0].id).toBe(true);
    expect(firstPage.cases.every((item) => item.category === "Products & E-commerce")).toBe(true);
  });
});
