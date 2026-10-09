// O build offline desativa Socket.IO por completo, inclusive a dependência de rede.
export function io():never { throw new Error("O multiplayer só está disponível no site online."); }
