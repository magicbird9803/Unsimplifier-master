export enum DataType {
	modelDataType,

	None,
	
	// map dispos
	Npc,
	Item,
	Mobj,
	Aobj,
	Bshape,
	Maplink,
	Effect,
	Gobj,

	ResourceGobj,


	// registries
	CharacterNpc,
	CharacterMobj,
	CharacterParty,
	CharacterItem,
	CharacterAobj,
	
	// data_model.elf
	DataNpcModel,
	DataItemModel,
	DataGobjModel,
	DataMobjModel,
	DataPlayerModel,
	DataModelEnd,

		// misc data.elf types
	// DataMuseum,
	DataEffect,
	DataMaplinkZoom,
	DataUi,
	
	MapId,
	ItemList,
	
	// this is the end of the actual file types and start of sub types
	TypeAmount,

	MaplinkHeader,

	ModelAssetGroup,
	ModelState,
	ModelFaceGroup,
	ModelFace,
	ModelAnimation,

	UiModel,
	UiModelProperty,
	UiMsg,
	UiShop,
	UiSellItem,
	UiMenu,

	ListItem,

}
