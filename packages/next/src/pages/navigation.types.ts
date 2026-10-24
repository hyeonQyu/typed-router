import type { NavigateArgs, NavigateArgsTuple, NavigateOptions } from '../navigation.types';

/** The Pages Router's navigation options: the App Router's, plus shallow routing. */
export type PagesNavigateOptions = NavigateOptions & {
  /** Update the URL without running `getServerSideProps`, `getStaticProps` or `getInitialProps` again. */
  shallow?: boolean;
};

export type PagesNavigateArgs<TTree, TPath extends string> = NavigateArgs<TTree, TPath, PagesNavigateOptions>;

export type PagesNavigateArgsTuple<TTree, TPath extends string> = NavigateArgsTuple<TTree, TPath, PagesNavigateOptions>;
