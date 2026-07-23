export const state = {
  user: null,
  posts: [],
  categoryTree: [],
  blocks: [],
  coverFile: null,
  coverUrl: "",
  saving: false,
  activeCategoryFilter: "",
  expandedCategoryPaths: new Set(),
  selectedPostIds: new Set(),
  duplicateIds: new Set(),
  smartLinks: [],
  smartLinksLoaded: false,
  smartLinksLoading: false
};
