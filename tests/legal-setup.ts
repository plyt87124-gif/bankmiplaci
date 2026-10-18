// tsconfig ma jsx: "preserve", więc tsx kompiluje JSX do React.createElement -
// w testach poza Next udostępniamy React globalnie (musi być importowane pierwsze).
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;
