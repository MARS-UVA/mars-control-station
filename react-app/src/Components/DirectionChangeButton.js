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
				backgroundColor: directionSwitched ? 'orange' : 'blue',
				color: 'white',
				border: 'none',
				borderRadius: 6,
				padding: '10px 16px',
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
