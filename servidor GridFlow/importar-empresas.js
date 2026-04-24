// Script de importação das empresas — rode UMA VEZ com o servidor ligado
const http = require('http');

const EMPRESAS = [
  { nome:'BRAVO DISTRIBUIDORA LTDA',                                        codigo_interno:'44',  cnpj:'09.022.276/0001-45', inscricao_estadual:'13.343.373-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'TOP TONER COMERCIO DE INSUMOS PARA INFORMATICA LTDA',             codigo_interno:'133', cnpj:'08.863.077/0001-05', inscricao_estadual:'13.339.149-3',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comercio/Prest.',     com_movimento:1 },
  { nome:'RMO MOVEIS LTDA',                                                  codigo_interno:'134', cnpj:'47.342.884/0001-26', inscricao_estadual:'',              regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:1 },
  { nome:'GOLD GRAOS AGRONEGOCIOS LTDA',                                     codigo_interno:'256', cnpj:'50.019.313/0001-60', inscricao_estadual:'13.989.190-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'MAIER E MUNIZ COMERCIO DE MEDICAMENTOS LTDA',                      codigo_interno:'307', cnpj:'40.822.669/0001-83', inscricao_estadual:'13.857.413-8',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Farmacia',            com_movimento:1 },
  { nome:'MENDES SUPERMERCADO LTDA',                                          codigo_interno:'309', cnpj:'49.594.888/0001-27', inscricao_estadual:'13.983.109-6',  regime_tributario:'Lucro Real',     municipio:'Jangada',             segmento:'Mercado',             com_movimento:1 },
  { nome:'DENTAL IMPERADOR LTDA',                                             codigo_interno:'341', cnpj:'01.587.257/0001-54', inscricao_estadual:'13.172.354-5',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE DE POSTOS DA HORA LTDA',                                       codigo_interno:'381', cnpj:'19.754.617/0001-20', inscricao_estadual:'13.569.610-0',  regime_tributario:'Lucro Real',     municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE DE POSTOS CONTI COMIGO LTDA (MTZ)',                            codigo_interno:'382', cnpj:'19.495.968/0001-64', inscricao_estadual:'13.604.758-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE DE POSTOS CONTI COMIGO LTDA (FL I)',                           codigo_interno:'383', cnpj:'19.495.968/0002-45', inscricao_estadual:'13.994.309-9',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'T. M. RAMOS DISTRIBUIDORA E COMERCIO',                              codigo_interno:'384', cnpj:'14.199.768/0001-40', inscricao_estadual:'13.439.429-1',  regime_tributario:'Lucro Real',     municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (MTZ)',                            codigo_interno:'385', cnpj:'29.897.237/0001-07', inscricao_estadual:'13.722.674-8',  regime_tributario:'Lucro Real',     municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL I)',                           codigo_interno:'386', cnpj:'29.897.237/0002-80', inscricao_estadual:'13.729.120-5',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL II)',                          codigo_interno:'387', cnpj:'29.897.237/0003-60', inscricao_estadual:'13.729.638-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL III)',                         codigo_interno:'388', cnpj:'29.897.237/0004-41', inscricao_estadual:'13.730.773-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL IV)',                          codigo_interno:'389', cnpj:'29.897.237/0005-22', inscricao_estadual:'13.730.772-1',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL V)',                           codigo_interno:'390', cnpj:'29.897.237/0006-03', inscricao_estadual:'13.739.374-1',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL VI)',                          codigo_interno:'391', cnpj:'29.897.237/0007-94', inscricao_estadual:'13.739.687-2',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL VII)',                         codigo_interno:'392', cnpj:'29.897.237/0008-75', inscricao_estadual:'13.739.688-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL VIII)',                        codigo_interno:'393', cnpj:'29.897.237/0009-56', inscricao_estadual:'13.791.135-1',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL IX)',                          codigo_interno:'394', cnpj:'29.897.237/0010-90', inscricao_estadual:'13.823.134-6',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL X)',                           codigo_interno:'395', cnpj:'29.897.237/0011-70', inscricao_estadual:'13.823.683-6',  regime_tributario:'Lucro Real',     municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL XI)',                          codigo_interno:'396', cnpj:'29.897.237/0012-51', inscricao_estadual:'13.863.558-7',  regime_tributario:'Lucro Real',     municipio:'Poconé',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL XII)',                         codigo_interno:'397', cnpj:'29.897.237/0013-32', inscricao_estadual:'13.907.619-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'REDE FRANCA COM. DE BEBIDAS LTDA (FL XIII)',                        codigo_interno:'398', cnpj:'29.897.237/0014-13', inscricao_estadual:'13.994.971-2',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (MTZ)',                      codigo_interno:'437', cnpj:'36.902.971/0001-74', inscricao_estadual:'13.133.552-9',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comercio/Prest.',     com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (FL II)',                    codigo_interno:'438', cnpj:'36.902.971/0003-36', inscricao_estadual:'13.365.289-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (FL III)',                   codigo_interno:'439', cnpj:'36.902.971/0004-17', inscricao_estadual:'13.365.485-0',  regime_tributario:'Lucro Real',     municipio:'Sinop',               segmento:'Comércio',            com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (FL IV)',                    codigo_interno:'440', cnpj:'36.902.971/0005-06', inscricao_estadual:'13.441.090-4',  regime_tributario:'Lucro Real',     municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (FL V)',                     codigo_interno:'441', cnpj:'36.902.971/0006-89', inscricao_estadual:'13.485.513-2',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'DATAPLUS INFORMATICA E ELETRONICA LTDA (FL VI)',                    codigo_interno:'442', cnpj:'36.902.971/0007-60', inscricao_estadual:'13.537.863-0',  regime_tributario:'Lucro Real',     municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:1 },
  { nome:'PUBLIC SOLUÇÕES EM TECNOLOGIA E GESTÃO LTDA',                       codigo_interno:'36',  cnpj:'31.422.683/0001-07', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:1 },
  { nome:'JUSTINIANO TAVORA COMERCIO DE MADEIRAS LTDA',                       codigo_interno:'47',  cnpj:'10.647.025/0001-35', inscricao_estadual:'13.367.425-8',  regime_tributario:'Presumido',      municipio:'Pontes Lacerda',      segmento:'Comércio',            com_movimento:0 },
  { nome:'MINI PREÇO OTICA E RELOJOARIA LTDA',                                codigo_interno:'115', cnpj:'45.329.502/0001-07', inscricao_estadual:'13.922.659-1',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'M. I DA ROCHA COM. DE PRODUTOS PARA CONSTRUÇÃO A SECO LTDA (MTZ)', codigo_interno:'94',  cnpj:'25.449.663/0001-19', inscricao_estadual:'13.644.475-0',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'M. I DA ROCHA COM. DE PRODUTOS PARA CONSTRUÇÃO A SECO LTDA (FL I)',codigo_interno:'325', cnpj:'25.449.663/0002-08', inscricao_estadual:'14.027.173-2',  regime_tributario:'Presumido',      municipio:'Primavera do Leste',  segmento:'Comércio',            com_movimento:0 },
  { nome:'M. I DA ROCHA COM. DE PRODUTOS PARA CONSTRUÇÃO A SECO LTDA (FL II)',codigo_interno:'465',cnpj:'25.449.663/0003-80', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'JLA DESIGN LTDA',                                                    codigo_interno:'139', cnpj:'43.679.654/0001-04', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'MARZINOTTI & CIA LTDA',                                              codigo_interno:'156', cnpj:'12.352.237/0001-10', inscricao_estadual:'13.789.050-8',  regime_tributario:'Presumido',      municipio:'Vila Bela',           segmento:'Comércio',            com_movimento:0 },
  { nome:'MASOTTI HOLDINGS, PARTICIPACOES E EMPREENDIMENTOS LTDA',             codigo_interno:'157', cnpj:'37.020.938/0001-83', inscricao_estadual:'13.813.568-1',  regime_tributario:'Presumido',      municipio:'Primavera do Leste',  segmento:'Comércio',            com_movimento:1 },
  { nome:'Y. T. FERREIRA & CIA LTDA',                                          codigo_interno:'159', cnpj:'35.828.421/0001-90', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Aluguel/Prest. Serv.',com_movimento:1 },
  { nome:'EMPORIO SANTA ROSA LTDA',                                            codigo_interno:'161', cnpj:'06.250.727/0001-03', inscricao_estadual:'13.259.312-2',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'G. COSTA EMPREENDIMENTOS',                                           codigo_interno:'182', cnpj:'03.867.681/0001-88', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'Aluguel Imoveis',     com_movimento:0 },
  { nome:'MARCOBRAS TRUCK CENTER LTDA',                                        codigo_interno:'202', cnpj:'40.812.111/0001-17', inscricao_estadual:'13.857.238-0',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'INOVA MED SERVIÇOS EM SAUDE LTDA',                                   codigo_interno:'258', cnpj:'48.739.214/0001-00', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'LB RESTAURANTE LTDA',                                                codigo_interno:'469', cnpj:'46.881.467/0001-99', inscricao_estadual:'13.946.516-2',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'LANCHONETE E PIZZARIA DO ALEMAO LTDA',                               codigo_interno:'471', cnpj:'26.629.695/0001-69', inscricao_estadual:'13.661.155-9',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'LACERDA SOCIEDADE INDIVIDUAL DE ADVOCACIA',                          codigo_interno:'286', cnpj:'21.518.787/0001-58', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'WDA TAXI AEREO LTDA',                                                codigo_interno:'342', cnpj:'00.320.967/0001-50', inscricao_estadual:'13.158.880-0',  regime_tributario:'Presumido',      municipio:'Varzea Grande',       segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'R. I. J. INCORPORAÇÃO E NEGOCIOS IMOBILIARIOS LTDA (Domus)',         codigo_interno:'343', cnpj:'49.857.136/0001-01', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'DOMUS MAXIMUS - SCP',                                                 codigo_interno:'344', cnpj:'52.016.682/0001-24', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'SCP',                 com_movimento:0 },
  { nome:'NC SOLUÇÕES QUIMICAS LTDA',                                           codigo_interno:'351', cnpj:'40.633.838/0001-37', inscricao_estadual:'13.858.675-6',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Indust/Comerc',       com_movimento:0 },
  { nome:'ARRUDA SERVIÇOS HOSPITALARES LTDA',                                   codigo_interno:'359', cnpj:'11.324.166/0001-80', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'PECUÁRIA BAGUARI LTDA',                                               codigo_interno:'364', cnpj:'01.491.537/0001-64', inscricao_estadual:'13.324.100-9',  regime_tributario:'Presumido',      municipio:'Barão Melgaço',       segmento:'Comércio',            com_movimento:0 },
  { nome:'PPM COMERCIO DE CHOCOLATES LTDA',                                     codigo_interno:'411', cnpj:'56.239.558/0001-89', inscricao_estadual:'14.073.612-3',  regime_tributario:'Presumido',      municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:0 },
  { nome:'GOLD TRADE IMPORTAÇÃO E EXPORTAÇÃO LTDA',                             codigo_interno:'418', cnpj:'08.220.114/0001-59', inscricao_estadual:'13.345.193-3',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'DABLIO FESTAS & LOCACOES LTDA (Wanderson)',                           codigo_interno:'427', cnpj:'04.807.144/0001-05', inscricao_estadual:'13.352.398-5',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comercio/Prest.',     com_movimento:0 },
  { nome:'DE PAULA CALHAS LTDA (Kelly Cristina)',                               codigo_interno:'451', cnpj:'38.132.552/0001-26', inscricao_estadual:'13.828.929-8',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'MT PHARMACY DISTRIB. DE MEDIC. E MAT. HOSP. LTDA (MTZ)',             codigo_interno:'449', cnpj:'04.227.210/0001-78', inscricao_estadual:'13.198.444-6',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'SOMAMED SERVIÇOS MEDICOS E HOSPITALARES LTDA',                        codigo_interno:'360', cnpj:'51.121.398/0001-55', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Prest. Serv.',        com_movimento:0 },
  { nome:'MT PHARMACY DISTRIB. DE MEDIC. E MAT. HOSP. LTDA (FL I)',            codigo_interno:'450', cnpj:'04.227.210/0002-59', inscricao_estadual:'13.881.372-8',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'MARTINS VARIEDADES LTDA (MTZ)',                                        codigo_interno:'417', cnpj:'31.397.806/0001-99', inscricao_estadual:'13.735.885-7',  regime_tributario:'Presumido',      municipio:'Varzea Grande',       segmento:'Comércio',            com_movimento:0 },
  { nome:'MARTINS VARIEDADES LTDA (FL I)',                                       codigo_interno:'421', cnpj:'31.397.806/0002-70', inscricao_estadual:'13.942.870-4',  regime_tributario:'Presumido',      municipio:'N. S. Livramento',    segmento:'Comércio',            com_movimento:0 },
  { nome:'Condominio Versalles',                                                 codigo_interno:'317', cnpj:'48.926.494/0001-66', inscricao_estadual:'',              regime_tributario:'Entid. S/ Fins', municipio:'Cuiabá',              segmento:'',                    com_movimento:1 },
  { nome:'Associação Pestalozzi',                                                codigo_interno:'38',  cnpj:'15.023.815/0001-63', inscricao_estadual:'',              regime_tributario:'Entid. S/ Fins', municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'Federação das Associações Pestalozzi',                                 codigo_interno:'263', cnpj:'12.010.215/0001-72', inscricao_estadual:'',              regime_tributario:'Entid. S/ Fins', municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'Instituto Missionário Kareebi',                                        codigo_interno:'244', cnpj:'28.282.924/0001-47', inscricao_estadual:'',              regime_tributario:'Entid. S/ Fins', municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'COPEMIMAT - COOPERATIVA MISTA AGROINDUSTRIAL DO MT',                   codigo_interno:'53',  cnpj:'42.658.832/0001-40', inscricao_estadual:'ISENTO',        regime_tributario:'Presumido',      municipio:'Varzea Grande',       segmento:'',                    com_movimento:0 },
  { nome:'CANAA FOLHA VERDE LTDA',                                               codigo_interno:'153', cnpj:'46.797.595/0001-59', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Manicoré-AM',         segmento:'',                    com_movimento:0 },
  { nome:'LASAS AGROPECUARIA LTDA',                                              codigo_interno:'155', cnpj:'46.727.826/0001-58', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Comércio',            com_movimento:0 },
  { nome:'AGROPECUARIA PANTANAL NORTE LTDA',                                     codigo_interno:'180', cnpj:'03.614.610/0001-73', inscricao_estadual:'120928515110',  regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'Comércio',            com_movimento:0 },
  { nome:'AGROCOSTA ARMAZENS GERAIS LTDA',                                       codigo_interno:'195', cnpj:'06.030.124/0001-04', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'S. J. da Barra - SP', segmento:'',                    com_movimento:0 },
  { nome:'AGROCOSTA PARTICIPAÇÕES LTDA',                                         codigo_interno:'181', cnpj:'62.094.727/0001-32', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'S. J. da Barra - SP', segmento:'',                    com_movimento:0 },
  { nome:'C2 EMPREENDIMENTO IMOBILIARIO LTDA',                                   codigo_interno:'183', cnpj:'26.627.985/0001-73', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'',                    com_movimento:0 },
  { nome:'BATUTA AGROPECUARIA E PARTICIPAÇÕES LTDS',                             codigo_interno:'184', cnpj:'35.832.787/0001-32', inscricao_estadual:'120637469119',  regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'Comércio',            com_movimento:0 },
  { nome:'TREZE RP NEGÓCIOS IMOBILIARIOS E PARTICIPAÇÕES LTDA',                  codigo_interno:'185', cnpj:'35.764.326/0001-70', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'',                    com_movimento:0 },
  { nome:'BORDA DA MATA AGROPECUARIA LTDA',                                      codigo_interno:'186', cnpj:'28.928.065/0001-10', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Rib. Preto - SP',     segmento:'',                    com_movimento:0 },
  { nome:'AGROPECUÁRIA FAZENDA CANAÃ LTDA',                                      codigo_interno:'209', cnpj:'26.637.219/0001-90', inscricao_estadual:'13.687.979-9',  regime_tributario:'Presumido',      municipio:'Araputanga',          segmento:'Comércio',            com_movimento:0 },
  { nome:'BRASIL MINERAÇÃO E PARTICIPAÇÕES EM EMPREENDIMENTOS LTDA',             codigo_interno:'224', cnpj:'49.090.991/0001-30', inscricao_estadual:'14.009.064-9',  regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'PANOFF PARTICIPAÇÕES EM EMPREENDIMENTOS LTDA',                         codigo_interno:'233', cnpj:'49.371.496/0001-07', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'RIO BARBADO HOLDINGS, PARTICIPAÇÕES E EMPREENDIMENTOS LTDA',           codigo_interno:'242', cnpj:'40.079.801/0001-09', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'RODERJAN & CIA LTDA',                                                   codigo_interno:'245', cnpj:'80.230.196/0001-40', inscricao_estadual:'90980394-20',   regime_tributario:'Presumido',      municipio:'Curitiba - PR',       segmento:'',                    com_movimento:0 },
  { nome:'RODERJAN ADMINISTRADORA DE BENS LTDA',                                 codigo_interno:'410', cnpj:'14.072.660/0001-92', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Curitiba - PR',       segmento:'',                    com_movimento:0 },
  { nome:'ALFA PART. EM EMPREENDIMENTOS LTDA',                                   codigo_interno:'287', cnpj:'50.916.413/0001-99', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'FRANCISCO ARTHUR JUNQUEIRA COSTA LTDA',                                codigo_interno:'295', cnpj:'51.308.646/0001-71', inscricao_estadual:'14.016.545-2',  regime_tributario:'Presumido',      municipio:'Caceres',             segmento:'Comércio',            com_movimento:0 },
  { nome:'CLELIA LACERDA EMPREENDIMENTOS LTDA',                                  codigo_interno:'377', cnpj:'54.776.956/0001-09', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'',                    com_movimento:0 },
  { nome:'LOTEAMENTO MATO GROSSO LTDA',                                          codigo_interno:'420', cnpj:'57.455.962/0001-52', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Incorporação',        com_movimento:0 },
  { nome:'ALINE LAURA FERREIRA MIRANDA',                                         codigo_interno:'457', cnpj:'28.000.398/0001-85', inscricao_estadual:'',              regime_tributario:'Presumido',      municipio:'Cuiabá',              segmento:'Agencia de Viagens',  com_movimento:0 },
];

function post(empresa) {
  return new Promise((resolve) => {
    const body = JSON.stringify(empresa);
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/empresas', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          resolve({ ok: res.statusCode === 201, erro: r.error || null });
        } catch { resolve({ ok: false, erro: 'Resposta inválida' }); }
      });
    });
    req.on('error', e => resolve({ ok: false, erro: e.message }));
    req.write(body); req.end();
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  IMPORTAR EMPRESAS - AMBAR v2');
  console.log('========================================\n');
  console.log(`Total: ${EMPRESAS.length} empresas\n`);

  let ok = 0, duplicadas = 0, erros = 0;

  for (let i = 0; i < EMPRESAS.length; i++) {
    const e = EMPRESAS[i];
    const r = await post(e);
    if (r.ok) {
      ok++;
      console.log(`✅ [${i+1}/${EMPRESAS.length}] ${e.nome}`);
    } else if (r.erro && r.erro.includes('cadastrada')) {
      duplicadas++;
      console.log(`⏭️  [${i+1}/${EMPRESAS.length}] ${e.nome} (já existe)`);
    } else {
      erros++;
      console.log(`❌ [${i+1}/${EMPRESAS.length}] ${e.nome} — ${r.erro}`);
    }
  }

  console.log('\n========================================');
  console.log(`  ✅ Criadas:     ${ok}`);
  console.log(`  ⏭️  Já existiam: ${duplicadas}`);
  console.log(`  ❌ Erros:       ${erros}`);
  console.log('========================================\n');
}

main();
