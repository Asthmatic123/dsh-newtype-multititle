declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
declare module '*.css' {
  const empty: Record<string, string>
  export default empty
}
