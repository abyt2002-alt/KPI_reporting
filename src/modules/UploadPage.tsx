import { useStore } from "../store/useStore";
import { CompactIngestionModal } from "./CompactIngestionModal";
import googleAdsImage from "../../image_resources/google_ads.jpg";
import googleAnalyticsImage from "../../image_resources/ga.jpg";
import metaAdsImage from "../../image_resources/meta ads.jpg";
import shopifyImage from "../../image_resources/shopify.jpg";
import amazonImage from "../../image_resources/amazon.jpg";

const SOURCES = [
  { source: "google_ads" as const, image: googleAdsImage, label: "Google Ads", note: "Campaign" },
  { source: "google_analytics" as const, image: googleAnalyticsImage, label: "Google Analytics", note: "Property" },
  { source: "meta_ads" as const, image: metaAdsImage, label: "Meta Ads", note: "Campaign" },
  { source: "shopify" as const, image: shopifyImage, label: "Shopify", note: "Store" },
  { source: "amazon_ads" as const, image: amazonImage, label: "Amazon Ads", note: "Search / Sales" },
];

export function UploadPage() {
  const { isIngestionModalOpen, ingestionModalSource, openIngestionModal } = useStore();

  return (
    <div className="relative min-h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_60%,_#eef2ff_100%)]">
      <div className="mx-auto flex min-h-full max-w-7xl items-center justify-center px-6 py-8 lg:px-10">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/80 px-10 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Select a source.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Choose a platform to configure account, template, and fields.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {SOURCES.map(({ source, image, label, note }) => {
                const active = ingestionModalSource === source;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => openIngestionModal(source)}
                    className={`group relative overflow-hidden rounded-3xl border px-5 py-5 text-left transition ${
                      active
                        ? "border-cyan-300 bg-cyan-50 shadow-[0_14px_50px_rgba(6,182,212,0.14)]"
                        : "border-slate-200 bg-white hover:border-cyan-200 hover:shadow-[0_14px_50px_rgba(15,23,42,0.08)]"
                    }`}
                  >
                    <div className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                      <img
                        src={image}
                        alt={label}
                        className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(15,23,42,0.08)]"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-4 text-left">
                      <p className="text-lg font-semibold text-slate-900">{label}</p>
                      <p className="mt-1 text-base text-slate-500">{note}</p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-cyan-500" : "bg-slate-300"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isIngestionModalOpen && ingestionModalSource ? <CompactIngestionModal source={ingestionModalSource} /> : null}
    </div>
  );
}
