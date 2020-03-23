declare module '*.css' {
  const __classes: { [key: string]: string };
  export default __classes;
}

declare module '*.frag' {
  const __src: string;
  export default __src;
}

declare module '*.vert' {
  const __src: string;
  export default __src;
}
