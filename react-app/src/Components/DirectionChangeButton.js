import React from 'react';

function DirectionChangeButton({ directionSwitched, setDirectionSwitched }) {
	const handleClick = () => {
		setDirectionSwitched(!directionSwitched);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			style={{
				backgroundColor: directionSwitched ? '#ffe6cc' : '#cce6ff',
				color: 'black',
				border: directionSwitched ? '2px solid #ff8c00' : '2px solid #0088ff',
				borderRadius: 6,
				padding: '14px 16px',
				cursor: 'pointer',
				fontSize: 16,
				fontWeight: 600,
			}}
		>
			Switch Direction
		</button>
	);
}

export default DirectionChangeButton;
