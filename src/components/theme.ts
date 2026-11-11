export const colors = {
  background: "#F4F6F8",
  surface: "#FFFFFF",
  text: "#14202B",
  muted: "#5B6B7A",
  border: "#D5DCE3",
  primary: "#0B6E4F",
  primaryText: "#FFFFFF",
  danger: "#B42318",
  warning: "#B54708",
  // The two sides of the court.
  sideA: "#1D4ED8",
  sideB: "#C2410C",
  serve: "#FACC15",
};

export const sideColor = (side: "A" | "B") => (side === "A" ? colors.sideA : colors.sideB);

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = 12;
