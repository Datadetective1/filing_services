import type { StaticImageData } from "next/image";
import cafeLaptop from "@/assets/photos/cafe-laptop.jpg";
import deliOwnerPhone from "@/assets/photos/deli-owner-phone.jpg";
import designerOnPhone from "@/assets/photos/designer-on-phone.jpg";
import florist from "@/assets/photos/florist.jpg";
import mainStreet from "@/assets/photos/main-street.jpg";
import ownerCoffeeShop from "@/assets/photos/owner-coffee-shop.jpg";
import ownerLaptopDesk from "@/assets/photos/owner-laptop-desk.jpg";
import paperworkKitchenTable from "@/assets/photos/paperwork-kitchen-table.jpg";
import potterWorkshop from "@/assets/photos/potter-workshop.jpg";
import relaxedDesk from "@/assets/photos/relaxed-desk.jpg";
import reliefDocument from "@/assets/photos/relief-document.jpg";
import shopCounter from "@/assets/photos/shop-counter.jpg";
import storefrontAwning from "@/assets/photos/storefront-awning.jpg";
import tailorSewingPhone from "@/assets/photos/tailor-sewing-phone.jpg";
import woodworker from "@/assets/photos/woodworker.jpg";

/**
 * Photography library. Every image is stored in the repo (no hotlinking) and is
 * licensed under the Unsplash License (free commercial use, no attribution
 * required; we credit photographers anyway on /legal/photo-credits).
 *
 * `focus` is the CSS object-position that keeps the subject in frame when the
 * image is cropped; `focusWide` overrides it on large screens.
 */
export interface Photo {
  src: StaticImageData;
  alt: string;
  focus: string;
  focusWide?: string;
  credit: { name: string; url: string };
}

function unsplash(slug: string): string {
  return `https://unsplash.com/photos/${slug}`;
}

export const PHOTOS = {
  ownerCoffeeShop: {
    src: ownerCoffeeShop,
    alt: "A smiling café owner in a plaid apron stands with her arms crossed behind her counter.",
    focus: "38% 30%",
    credit: { name: "Vitaly Gariev", url: unsplash("a-smiling-woman-stands-in-her-coffee-shop-QGg-vsPYbu8") },
  },
  paperworkKitchenTable: {
    src: paperworkKitchenTable,
    alt: "A woman on a phone call works through paperwork on her laptop at the kitchen table.",
    focus: "30% 40%",
    credit: { name: "Vitaly Gariev", url: unsplash("woman-talking-on-phone-while-working-on-laptop-at-table-j5B2A4R4NKU") },
  },
  ownerLaptopDesk: {
    src: ownerLaptopDesk,
    alt: "A small business owner works on a laptop at a desk in her shop.",
    focus: "70% 45%",
    credit: { name: "Omar Lopez", url: unsplash("a-woman-sitting-at-a-desk-using-a-laptop-computer-4HhmpfsI5yk") },
  },
  tailorSewingPhone: {
    src: tailorSewingPhone,
    alt: "A tailor smiles at his phone while working at his sewing machine.",
    focus: "55% 40%",
    credit: { name: "Ali Mkumbwa", url: unsplash("a-man-smiles-as-he-uses-a-sewing-machine-cU3xxfbB9Es") },
  },
  deliOwnerPhone: {
    src: deliOwnerPhone,
    alt: "A shop owner in an apron checks a message on his phone behind the counter.",
    focus: "35% 45%",
    credit: { name: "Ali Mkumbwa", url: unsplash("a-man-in-an-apron-looking-at-a-cell-phone-uk3ey_vhDKA") },
  },
  reliefDocument: {
    src: reliefDocument,
    alt: "A man celebrates while reading a document at his kitchen table.",
    focus: "60% 35%",
    credit: { name: "Vitaly Gariev", url: unsplash("man-celebrating-while-reading-a-document-at-kitchen-table-gimJXuHZA-A") },
  },
  relaxedDesk: {
    src: relaxedDesk,
    alt: "A woman leans back at her desk with her hands behind her head, work finished.",
    focus: "50% 35%",
    credit: { name: "Vitaly Gariev", url: unsplash("a-woman-sitting-at-a-desk-with-her-hands-behind-her-head-_PXvNHH7Bf4") },
  },
  shopCounter: {
    src: shopCounter,
    alt: "A shopkeeper sits at the counter of her neighborhood store.",
    focus: "50% 45%",
    credit: { name: "Ali Mkumbwa", url: unsplash("a-woman-sitting-at-a-counter-in-a-store-EOkN2pRjFsg") },
  },
  mainStreet: {
    src: mainStreet,
    alt: "Historic storefronts line a small-town main street on a sunny day.",
    focus: "50% 55%",
    credit: { name: "Land O'Lakes, Inc.", url: unsplash("historic-storefronts-line-a-charming-small-town-street-iVINr8-ZFmY") },
  },
  storefrontAwning: {
    src: storefrontAwning,
    alt: "A small shop front with a red and white striped awning and a blue door.",
    focus: "50% 40%",
    credit: { name: "Spencer Imbrock", url: unsplash("white-and-red-store-front-during-daytime-3k7SoyBf564") },
  },
  designerOnPhone: {
    src: designerOnPhone,
    alt: "A business owner talks on the phone while working on her laptop in her studio.",
    focus: "55% 35%",
    credit: { name: "Vitaly Gariev", url: unsplash("fashion-designer-on-the-phone-working-on-a-laptop-kk4J92iaSBk") },
  },
  cafeLaptop: {
    src: cafeLaptop,
    alt: "A smiling woman works on her laptop at a café table.",
    focus: "50% 30%",
    credit: { name: "FOTOGRAFÍA EDITORIAL", url: unsplash("a-smiling-woman-works-on-a-laptop-at-a-cafe-9nk--dNEPyE") },
  },
  woodworker: {
    src: woodworker,
    alt: "A woodworker smiles as he shapes a board in his workshop.",
    focus: "55% 40%",
    credit: { name: "Ali Mkumbwa", url: unsplash("a-man-smiles-as-he-works-on-a-piece-of-wood-PxlKOcj0a3Q") },
  },
  potterWorkshop: {
    src: potterWorkshop,
    alt: "A potter in a clay-streaked apron stands proudly in his workshop.",
    focus: "55% 35%",
    credit: { name: "Vitaly Gariev", url: unsplash("a-potter-smiles-proudly-in-his-workshop-XbOismtoTXs") },
  },
  florist: {
    src: florist,
    alt: "A florist holds a fresh bouquet of pink and white flowers.",
    focus: "50% 55%",
    credit: { name: "Waldemar Brandt", url: unsplash("woman-wearing-gray-cardigan-holding-flower-bouquet-q3RGXuBc_SU") },
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
