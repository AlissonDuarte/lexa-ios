/// <reference types="nativewind/types" />

// O import de efeito colateral do global.css e o que injeta as classes do
// Tailwind no bundle (ver metro.config.js). O TS precisa da declaracao para
// nao tratar o .css como modulo desconhecido.
declare module '*.css';
