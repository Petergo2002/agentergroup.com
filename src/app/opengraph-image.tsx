import { ImageResponse } from "next/og";

export const alt = "Agentergroup — Meet Milo, your AI employee for the web";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#faf9f7",
          color: "#181818",
          padding: "68px 76px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            right: -100,
            top: -180,
            borderRadius: 999,
            background: "rgba(255, 92, 2, 0.13)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            right: 90,
            bottom: -170,
            borderRadius: 999,
            background: "rgba(255, 92, 2, 0.08)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", width: "100%", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                background: "#ff5c02",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 28,
              }}
            >
              A
            </div>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 800, letterSpacing: -1 }}>
              AGENTERGROUP
            </div>
          </div>

          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 60 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
              <div
                style={{
                  display: "flex",
                  color: "#d64c00",
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                }}
              >
                Meet Milo — your AI employee
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  fontSize: 66,
                  lineHeight: 1.02,
                  letterSpacing: -3.6,
                  fontWeight: 900,
                }}
              >
                Turn every website visit into a helpful conversation.
              </div>
            </div>

            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: 110,
                background: "#181818",
                border: "8px solid #ffffff",
                boxShadow: "0 28px 70px rgba(24,24,24,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  border: "4px solid #ff5c02",
                  color: "#ff5c02",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 72,
                  fontWeight: 800,
                }}
              >
                M
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
