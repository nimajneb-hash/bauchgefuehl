// Lokales Lebensmittel-Wörterbuch.
// Format je Zeile: "schlüssel|schlüssel2 ; Anzeigename ; KATEGORIEN"
// Schlüssel sind normalisiert (klein, ä→ae, ö→oe, ü→ue, ß→ss).
// Präfixe: "=" nur ganzes Wort, "<" nur am Wortanfang, ">" nur am Wortende.
// Ohne Präfix wird auch innerhalb zusammengesetzter Wörter gefunden ("vollkornbrot" ⊃ "brot").
// Der längste Treffer gewinnt, d. h. "kaesekuchen" schlägt "kaese" + "kuchen".

export const CATEGORIES = {
  LA: { name: 'Laktose', icon: '🥛' },
  MP: { name: 'Milcheiweiß', icon: '🧀' },
  GL: { name: 'Weizen / Gluten', icon: '🌾' },
  ZW: { name: 'Zwiebel & Knoblauch', icon: '🧅' },
  FR: { name: 'Fruktose', icon: '🍎' },
  SO: { name: 'Sorbit & Zuckeralkohole', icon: '🍬' },
  HF: { name: 'Hülsenfrüchte', icon: '🫘' },
  KH: { name: 'Kohl & Blähgemüse', icon: '🥦' },
  HI: { name: 'Histaminreich', icon: '🍷' },
  KO: { name: 'Koffein', icon: '☕' },
  AL: { name: 'Alkohol', icon: '🍺' },
  SC: { name: 'Scharf', icon: '🌶️' },
  FE: { name: 'Fettig & Frittiert', icon: '🍟' },
  KS: { name: 'Kohlensäure', icon: '🫧' },
  SU: { name: 'Süßstoff', icon: '🧪' },
  ZU: { name: 'Zucker & Süßes', icon: '🍰' },
  EI: { name: 'Ei', icon: '🥚' },
  NU: { name: 'Nüsse', icon: '🥜' },
  SJ: { name: 'Soja', icon: '🌱' },
  FI: { name: 'Fisch & Meeresfrüchte', icon: '🐟' },
  NS: { name: 'Tomate & Nachtschatten', icon: '🍅' },
};

const RAW = `
milch ; Milch ; LA MP
=vollmilch|fettarme milch ; Milch ; LA MP
milchkaffee ; Milchkaffee ; KO LA MP
<latte|cappuccino|flat white|cafe au lait ; Kaffee mit Milch ; KO LA MP
kakao|heisse schokolade ; Kakao ; LA MP ZU
joghurt|jogurt ; Joghurt ; LA MP
skyr ; Skyr ; LA MP
quark ; Quark ; LA MP
frischkaese ; Frischkäse ; LA MP
schmand|saure sahne|sauerrahm ; Saure Sahne ; LA MP FE
creme fraiche ; Crème fraîche ; LA MP FE
sahne|schlagsahne ; Sahne ; LA MP FE
butter ; Butter ; MP FE
buttermilch ; Buttermilch ; LA MP
kefir ; Kefir ; LA MP
=eis|eiscreme|speiseeis|softeis|eisbecher ; Eis ; LA MP ZU FE
pudding ; Pudding ; LA MP ZU
milchreis ; Milchreis ; LA MP ZU
mozzarella|burrata ; Mozzarella ; LA MP
=feta|schafskaese|hirtenkaese ; Feta ; LA MP
parmesan|grana padano|pecorino ; Parmesan ; MP HI
gouda|emmentaler|bergkaese|hartkaese|cheddar|edamer|appenzeller|gruyere ; Hartkäse ; MP HI
camembert|=brie|blauschimmel|gorgonzola|roquefort ; Weichkäse ; MP HI LA
kaese ; Käse ; MP LA HI
reibekaese|streukaese ; Reibekäse ; MP HI
raclette ; Raclette ; MP HI FE
fondue ; Käsefondue ; MP HI FE AL
halloumi ; Halloumi ; MP LA
ricotta ; Ricotta ; LA MP
mascarpone ; Mascarpone ; LA MP FE
milchschokolade|vollmilchschokolade ; Milchschokolade ; LA MP ZU FE
schokolade|schoki|schokoriegel ; Schokolade ; ZU FE MP LA
zartbitter|bitterschokolade ; Zartbitterschokolade ; ZU FE KO
nutella|nougatcreme ; Nussnougatcreme ; ZU FE NU MP LA
laktosefrei ; _ ;
hafermilch|haferdrink|hafer drink ; Hafermilch ;
sojamilch|sojadrink|soja drink ; Sojamilch ; SJ
mandelmilch|mandeldrink ; Mandelmilch ; NU
kokosmilch ; Kokosmilch ; FE
reismilch|reisdrink ; Reismilch ;

brot|stulle|graubrot ; Brot ; GL
vollkornbrot ; Vollkornbrot ; GL
roggenbrot|roggen ; Roggenbrot ; GL
pumpernickel ; Pumpernickel ; GL
dinkel ; Dinkel ; GL
broetchen|semmel|schrippe|weckle|wecken ; Brötchen ; GL
toast ; Toast ; GL
baguette|ciabatta|focaccia ; Weißbrot ; GL
brezel|breze|laugen ; Brezel ; GL
croissant|franzbroetchen|plunder|blaetterteig ; Croissant ; GL LA MP FE ZU
nudeln|pasta|spaghetti|penne|fusilli|tagliatelle|rigatoni|farfalle|makkaroni|tortellini|ravioli|linguine ; Nudeln ; GL
carbonara ; Carbonara ; GL EI MP HI FE
bolognese ; Bolognese ; NS ZW
lasagne ; Lasagne ; GL LA MP NS ZW
spaetzle ; Spätzle ; GL EI
kaesespaetzle ; Käsespätzle ; GL EI MP LA HI FE ZW
maultaschen ; Maultaschen ; GL EI
pizza ; Pizza ; GL LA MP NS
flammkuchen ; Flammkuchen ; GL LA MP FE ZW
doener|doner|kebab|doenerteller ; Döner ; GL ZW SC FE MP
duerum|durum|wrap|yufka ; Wrap ; GL
burger|cheeseburger|hamburger ; Burger ; GL FE MP
pommes|fritten|frites ; Pommes ; FE NS
kuchen ; Kuchen ; GL ZU EI LA MP FE
kaesekuchen|kaesesahne ; Käsekuchen ; LA MP GL ZU EI
torte ; Torte ; GL ZU EI LA MP FE
muffin|cupcake|brownie|donut|berliner|krapfen ; Gebäck ; GL ZU EI FE LA MP
keks|kekse|cookie|plaetzchen ; Kekse ; GL ZU FE
zwieback ; Zwieback ; GL
muesli ; Müsli ; GL FR
granola|knuspermuesli|crunchy ; Knuspermüsli ; GL ZU FE
haferflocken|porridge|oatmeal|haferbrei ; Haferflocken ;
cornflakes|frosties|cerealien|smacks ; Cornflakes ; ZU
>reis|=reis|basmati|jasminreis|risotto ; Reis ;
quinoa ; Quinoa ;
couscous|bulgur|griess ; Couscous / Bulgur ; GL
kartoffel|kartoffeln|erdaepfel|pellkartoffel|salzkartoffel ; Kartoffeln ; NS
kartoffelbrei|kartoffelpueree|pueree ; Kartoffelbrei ; NS LA MP
kartoffelsalat ; Kartoffelsalat ; NS ZW EI FE
bratkartoffeln|roesti|kartoffelpuffer|reibekuchen ; Bratkartoffeln ; NS FE
kroketten ; Kroketten ; NS FE GL
pfannkuchen|pancake|pancakes|crepe|crepes|eierkuchen ; Pfannkuchen ; GL EI LA MP
waffel|waffeln ; Waffeln ; GL EI LA MP ZU
gnocchi ; Gnocchi ; GL NS
schnitzel|paniert|panade|cordon bleu ; Schnitzel (paniert) ; GL EI FE
chips|kartoffelchips ; Chips ; FE NS
popcorn ; Popcorn ;
salzstangen|cracker|knaecke|knaeckebrot ; Cracker ; GL
sushi|=maki|nigiri ; Sushi ; FI SJ
ramen ; Ramen ; GL SJ ZW
=pho ; Pho ; ZW
=mais|maiskolben ; Mais ;
tacos|taco|burrito|quesadilla|enchilada ; Burrito / Tacos ; GL HF NS SC ZW MP
nachos ; Nachos ; FE NS MP
=curry|currys|thai curry|indisch ; Curry ; SC ZW
=gyros ; Gyros ; FE ZW
frikadelle|bulette|fleischpflanzerl ; Frikadelle ; GL EI ZW FE

zwiebel|zwiebeln ; Zwiebel ; ZW
fruehlingszwiebel|lauchzwiebel ; Frühlingszwiebel ; ZW
lauch|porree ; Lauch ; ZW
knoblauch ; Knoblauch ; ZW
schalotte|schalotten ; Schalotten ; ZW
aioli ; Aioli ; ZW EI FE
tzatziki|zaziki|tsatsiki ; Tzatziki ; ZW LA MP
=kohl|weisskohl|spitzkohl|kohlsalat|krautsalat|coleslaw ; Kohl ; KH
rotkohl|blaukraut|rotkraut ; Rotkohl ; KH
sauerkraut ; Sauerkraut ; KH HI
rosenkohl ; Rosenkohl ; KH
brokkoli|broccoli ; Brokkoli ; KH
blumenkohl ; Blumenkohl ; KH
wirsing ; Wirsing ; KH
gruenkohl ; Grünkohl ; KH
kohlrabi ; Kohlrabi ; KH
spargel ; Spargel ; FR
pilze|champignons|champignon|pfifferlinge|steinpilze ; Pilze ; SO
artischocke|artischocken ; Artischocke ; FR
avocado|guacamole ; Avocado ; SO HI FE
tomate|tomaten|cherrytomaten ; Tomaten ; NS HI
tomatensosse|tomatensauce|passata|marinara ; Tomatensoße ; NS HI ZW
ketchup ; Ketchup ; NS ZU
paprika ; Paprika ; NS
aubergine|auberginen ; Aubergine ; NS HI
chili|chilis|jalapeno|jalapenos|peperoni|peperoncini ; Chili ; SC NS
chili con carne ; Chili con Carne ; HF NS SC ZW
sriracha|tabasco|sambal|harissa ; Scharfe Soße ; SC
=scharf|=scharfe|=scharfes|=scharfen ; scharf gewürzt ; SC
gurke|gurken ; Gurke ;
salat|blattsalat|eisbergsalat|rucola|feldsalat ; Salat ;
spinat ; Spinat ; HI
karotte|karotten|moehre|moehren|=wurzel ; Karotten ;
zucchini ; Zucchini ;
erbsen ; Erbsen ; HF
sellerie ; Sellerie ;
fenchel ; Fenchel ;
rote bete|rote beete ; Rote Bete ;
kuerbis ; Kürbis ;

bohnen|kidneybohnen|weisse bohnen|baked beans ; Bohnen ; HF
gruene bohnen|brechbohnen|prinzessbohnen ; Grüne Bohnen ;
kaffeebohne|kaffeebohnen ; Kaffee ; KO
linsen|=dal|dhal ; Linsen ; HF
kichererbsen ; Kichererbsen ; HF
hummus|humus ; Hummus ; HF ZW
falafel ; Falafel ; HF ZW FE
erdnuss|erdnuesse ; Erdnüsse ; NU HF
erdnussbutter ; Erdnussbutter ; NU HF FE
edamame ; Edamame ; SJ HF
tofu ; Tofu ; SJ
sojasosse|sojasauce|=soja ; Sojasoße ; SJ GL HI

apfel|aepfel ; Apfel ; FR SO
birne|birnen ; Birne ; FR SO
mango|mangos ; Mango ; FR
wassermelone ; Wassermelone ; FR SO
melone|honigmelone ; Melone ;
kirsche|kirschen ; Kirschen ; FR SO
pflaume|pflaumen|zwetschge|zwetschgen ; Pflaumen ; SO
aprikose|aprikosen ; Aprikosen ; SO
pfirsich|pfirsiche|nektarine|nektarinen ; Pfirsich ; SO
banane|bananen ; Banane ;
trauben|weintrauben|weintraube ; Weintrauben ; FR
erdbeere|erdbeeren ; Erdbeeren ; HI
himbeere|himbeeren|brombeeren ; Beeren ;
blaubeere|blaubeeren|heidelbeere|heidelbeeren ; Heidelbeeren ;
orange|orangen|apfelsine|mandarine|mandarinen|clementine ; Zitrusfrüchte ; HI
zitrone ; Zitrone ;
kiwi ; Kiwi ; HI
ananas ; Ananas ; HI
datteln|dattel ; Datteln ; FR
feige|feigen ; Feigen ; FR
rosinen ; Rosinen ; FR
trockenobst|trockenfruechte ; Trockenobst ; FR SO
=obst ; Obst ; FR
obstsalat ; Obstsalat ; FR
weizenmehl|=mehl|weissmehl ; Mehl ; GL
smoothie ; Smoothie ; FR
apfelsaft ; Apfelsaft ; FR SO
orangensaft|osaft ; Orangensaft ; HI
=saft|fruchtsaft|multivitaminsaft ; Saft ; FR
honig ; Honig ; FR ZU
agavendicksaft|agave ; Agavendicksaft ; FR ZU
apfelmus ; Apfelmus ; FR SO

kaffee|=cafe|filterkaffee ; Kaffee ; KO
espresso ; Espresso ; KO
cola|coca cola|pepsi ; Cola ; KO KS ZU
cola zero|coke zero|cola light|pepsi max ; Cola Zero ; KO KS SU
energy|energydrink|red bull|monster ; Energydrink ; KO KS ZU
schwarztee|gruentee|gruener tee|schwarzer tee|=mate|matcha|chai ; Schwarzer/Grüner Tee ; KO
>tee|=tee ; Tee ;
mineralwasser|sprudel|sprudelwasser|=selters ; Sprudelwasser ; KS
limo|limonade|fanta|sprite|spezi|eistee ; Limonade ; KS ZU
schorle|apfelschorle ; Saftschorle ; FR KS
>bier|=bier|=pils|=helles|=weizen|weizenbier|weissbier|radler ; Bier ; AL KS GL
alkoholfrei ; _ ;
>wein|=wein|rotwein|weisswein|=rose ; Wein ; AL HI
sekt|prosecco|champagner|cava|cremant ; Sekt ; AL KS HI
schnaps|wodka|=gin|=rum|whisky|whiskey|likoer|tequila|ouzo|jaegermeister ; Schnaps ; AL
cocktail|cocktails|aperol|=spritz|=hugo|mojito ; Cocktail ; AL KS ZU

zuckerfrei ; _ ;
=light|=zero ; Light/Zero ; SU
kaugummi ; Kaugummi ; SO SU
xylit|erythrit|sorbit|maltit|birkenzucker ; Zuckeraustausch ; SO
aspartam|stevia|suessstoff|sucralose ; Süßstoff ; SU
proteinriegel|eiweissriegel|proteinpulver|proteinshake|whey ; Proteinriegel/-shake ; SO SU MP
zucker ; Zucker ; ZU
suessigkeiten|gummibaerchen|haribo|bonbons|lakritz ; Süßigkeiten ; ZU
marmelade|konfituere ; Marmelade ; ZU FR
sirup ; Sirup ; ZU

=ei|=eier|eiern ; Ei ; EI
ruehrei|spiegelei|omelett|omelette|fruehstuecksei|fruehstueckseier ; Ei ; EI
mayo|mayonnaise|remoulade ; Mayonnaise ; EI FE
fisch|fischstaebchen ; Fisch ; FI
lachs ; Lachs ; FI
raeucherlachs|raeucherfisch ; Räucherlachs ; FI HI
thunfisch ; Thunfisch ; FI HI
garnele|garnelen|shrimps|shrimp|krabben|scampi|gambas ; Garnelen ; FI
muscheln|miesmuscheln|tintenfisch|calamari ; Meeresfrüchte ; FI
hering|makrele|sardinen|matjes|sardellen ; Hering/Makrele ; FI HI
salami ; Salami ; HI FE
schinken ; Schinken ; HI
speck|bacon ; Speck ; FE HI
wurst|bratwurst|wuerstchen|wiener|frankfurter|weisswurst|leberwurst|leberkaese ; Wurst ; FE
currywurst ; Currywurst ; FE NS ZU SC
hackfleisch|=hack ; Hackfleisch ;
steak|=rind|rindfleisch|roastbeef ; Rindfleisch ;
haehnchen|haenchen|huhn|huehnchen|chicken|=pute|putenbrust|haehnchenbrust ; Hähnchen ;
nuggets|chicken nuggets|chicken wings|wings ; Chicken Nuggets ; FE GL
schwein|schweinefleisch|schweinebraten|kotelett|nackensteak ; Schweinefleisch ;
lamm|lammfleisch ; Lamm ;
nuss|nuesse|walnuss|walnuesse|haselnuss|haselnuesse|mandeln|mandel|cashew|cashews|pistazien|pekannuss|macadamia ; Nüsse ; NU
pesto ; Pesto ; NU MP ZW FE
balsamico ; Balsamico ; HI FR
essig ; Essig ; HI
frittiert|frittiertes|fritiert ; frittiert ; FE
mcdonalds|burger king|fast food|fastfood ; Fast Food ; GL FE ZU
`;

// Wörter, die Kategorien der ganzen Mahlzeit entfernen oder ändern.
export const MODIFIERS = [
  { key: 'laktosefrei', remove: ['LA'] },
  { key: 'glutenfrei', remove: ['GL'] },
  { key: 'vegan', remove: ['LA', 'MP', 'EI', 'FI'] },
  { key: 'zuckerfrei', remove: ['ZU'] },
  { key: 'alkoholfrei', remove: ['AL'] },
  { key: 'entkoffeiniert', remove: ['KO'] },
  { key: 'koffeinfrei', remove: ['KO'] },
  { key: 'decaf', remove: ['KO'] },
];

export function parseDictionary(raw = RAW) {
  const entries = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [keys, name, cats = ''] = t.split(';').map((s) => s.trim());
    const catList = cats.split(/\s+/).filter(Boolean);
    for (const k of keys.split('|')) {
      const key = k.trim();
      if (key) entries.push({ key, name, cats: catList });
    }
  }
  return entries;
}

export const BUILTIN = parseDictionary();
