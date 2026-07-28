export const state = {
  user: null,
  posts: [],
  categoryTree: [],
  blocks: [],
  coverFile: null,
  coverUrl: "",
  saving: false,
  activeCategoryFilter: "",
  postViewMode: "all",
  expandedCategoryPaths: new Set(),
  selectedPostIds: new Set(),
  duplicateIds: new Set(),
  smartLinks: [],
  smartLinksLoaded: false,
  smartLinksLoading: false
};
