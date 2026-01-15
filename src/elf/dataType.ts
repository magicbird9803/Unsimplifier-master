export enum DataType {
	None,
	
	// map dispos
	Npc,
	Item,
	Mobj,
	Aobj,
	Bshape,
	GobjRes,
	Effect,
	MapParam,
	Maplink,
	
	// registries
	CharacterNpc,
	CharacterMobj,
	CharacterParty,
	CharacterItem,
	CharacterAobj,
	DataEffect,
	
	MapId,
	ItemList,
	MapItemLotTable,
	EventFlag,

	SndBattle,
	BgmData,
	//parameters
	ParamActionBalloon,
	ParamFade,
	ParamField,
	ParamHouseDoor,
	ParamJump,
	ParamPartyHint,
	ParamPlayer,
	ParamGobj,
	ParamGobjItem,
	DataMinigamePaperAiper,
	DataMinigamePaperFan,
	DataMinigamePaperRunner,
	DataMinigamePaperRunnerai,

	//battle
	Monosiri,
	FallObj,
	Nozzle,
	HeartParam,
	Parameter,

	BattleWeaponMario,
	BattleWeaponParty,
	BattleWeaponOther,
	BattleWeaponEnemy,
	BattleWeaponItem,
	BattleWeaponAcMarioAc,
	BattleWeaponAcPartyAc,

	BattleAudienceKind,

	// data_model.elf
	DataBattleModel,
	DataGobjModel,
	DataItemModel,
	DataMobjModel,
	DataNpcModel,
	DataPlayerModel,

	DataUi,

	// this is the end of the actual file types and start of sub types
	TypeAmount,
	ListItem,
	HeartItem,
	ModelType,
	ModelAssetGroup,
	ModelState,
	ModelFaceGroup,
	ModelFace,
	ModelAnimation,

	UiIcon,
	UiStyle,
	UiModel,
	UiModelProperty,
	UiMsg,
	UiShop,
	UiSellItem,
	UiIconMenu,
	UiMail,
	UiSeaMap,
	UiMenu,
	UiUranaisi,
	UiStar,
	UiShine,
	UiGalleryArt,
	UiGallerySound,
	UiAcMaster,
	UiSelectwindow,

	
	MaplinkHeader,

	SndBattleHeader,
}
