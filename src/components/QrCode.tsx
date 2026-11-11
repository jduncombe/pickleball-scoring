import { Image, Platform, View } from "react-native";
import { SvgXml } from "react-native-svg";

/** The SVG markup inside a data: URI (base64 or percent-encoded). */
export function svgFromDataUri(uri: string): string | null {
  const match = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/s.exec(uri);
  if (!match) return null;
  const [, params = "", payload] = match;
  try {
    return params.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/** Renders the API's QR code (an SVG data: URI): natively on Android and iOS, as an image on the web. */
export function QrCode({ dataUri, size = 220 }: { dataUri: string; size?: number }) {
  if (Platform.OS === "web") {
    // Browsers render the data: URI directly.
    return <Image source={{ uri: dataUri }} style={{ width: size, height: size, alignSelf: "center" }} />;
  }
  const xml = svgFromDataUri(dataUri);
  if (!xml) return null;
  return (
    <View style={{ alignSelf: "center", backgroundColor: "#fff", padding: 8 }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
